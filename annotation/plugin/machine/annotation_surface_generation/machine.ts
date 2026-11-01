import { createActor, createMachine } from 'xstate';
import { Etl } from '@/ontobdc/shared/adapter/etl';
import type { NamedCall } from '@/ontobdc/shared/adapter/statechart-converter';
import type { CapabilityClass } from '@/ontobdc/shared/domain/model/capability';
import type { DocumentImage } from '@/ontobdc/shared/domain/model/document-image';
import type { AnnotationSurfaceGenerationHandlerPort, AnnotationSurfaceGenerationRequest } from './port';
import { AnnotationSurfaceGenerationState, type AnnotationSurfaceGenerationStateValue } from './state';
import { AnnotationSurfaceGenerationStatechart } from './statechart';

type CapabilityModule = Record<string, unknown>;

/** Discover the capabilities of the module without executing them yet. */
const capabilityImports = import.meta.glob<CapabilityModule>('../../capability/transformation/*.ts');

const PORT_NAME = 'AnnotationSurfaceGenerationStatePort';

/** `AnnotationSurfaceGenerationStatePort.SURFACE_DOCUMENT_READ` into the state it names. */
const stateOf = (constant: string): AnnotationSurfaceGenerationStateValue => {
  const [port, name] = constant.split('.');
  const value = (AnnotationSurfaceGenerationState as Record<string, AnnotationSurfaceGenerationStateValue>)[name];
  if (port !== PORT_NAME || value === undefined) throw new Error(`Unknown state constant: ${constant}`);
  return value;
};

/**
 * Drives the statechart that draws the document of an annotation as one image.
 *
 * The statechart decides which state comes next, and its guard asks whether the state is the one that follows the
 * current one. The capability of a state is not listed anywhere: its id is the prefix plus the name of the state, and
 * the driver runs it before it lets the machine enter that state. A capability that fails throws, and so does the
 * machine: a state is only reached when it makes sense to go on.
 */
export class AnnotationSurfaceGenerationMachine implements AnnotationSurfaceGenerationHandlerPort {
  static readonly NAME = 'annotation_surface_generation';
  static readonly CAPABILITY_ID_PREFIX = 'org.annotations.plugin.capability.transformation.target.';
  static readonly FINAL_STATE = AnnotationSurfaceGenerationState.SURFACE_IMAGE_RENDERED;

  private active: AnnotationSurfaceGenerationStateValue = AnnotationSurfaceGenerationState.UNDEFINED;

  constructor(
    private readonly request: AnnotationSurfaceGenerationRequest,
    private readonly etl: Etl = new Etl(),
  ) {}

  canTransitTo(state: AnnotationSurfaceGenerationStateValue): boolean {
    const sequence = AnnotationSurfaceGenerationStatechart.sequence();
    return sequence[sequence.indexOf(this.active) + 1] === state;
  }

  performStateTransition(state: AnnotationSurfaceGenerationStateValue): void {
    this.active = state;
  }

  /** Walks the statechart to its final state and returns the image the document was drawn as. */
  async execute(): Promise<DocumentImage> {
    const requestId = crypto.randomUUID();
    const config = AnnotationSurfaceGenerationStatechart.config();
    const sequence = AnnotationSurfaceGenerationStatechart.sequence();

    const implement = (call: NamedCall): (() => boolean) | (() => void) => {
      const state = stateOf(call.params.to_state);
      if (call.type === 'handler.can_transit_to') return () => this.canTransitTo(state) !== call.negated;
      if (call.type === 'handler.perform_state_transition') return () => this.performStateTransition(state);
      throw new Error(`Unknown statechart call: ${call.type}`);
    };

    const machine = createMachine({
      id: config.id,
      initial: config.initial,
      states: Object.fromEntries(Object.entries(config.states).map(([name, node]) => [name, {
        ...(node.type ? { type: node.type } : {}),
        meta: node.meta,
        ...(node.on ? { on: { STEP: node.on.STEP.map((transition) => ({
          target: transition.target,
          ...(transition.guard ? { guard: implement(transition.guard) as () => boolean } : {}),
          ...(transition.actions ? { actions: transition.actions.map((action) => implement(action) as () => void) } : {}),
        })) } } : {}),
      }])),
    });

    const actor = createActor(machine);
    actor.start();
    try {
      while (actor.getSnapshot().status !== 'done') {
        const current = String(actor.getSnapshot().value);
        const next = sequence[sequence.indexOf(current) + 1];
        if (next === undefined) throw new Error(`The statechart has no state after ${current}.`);

        await this.runCapability(requestId, next as AnnotationSurfaceGenerationStateValue);
        actor.send({ type: 'STEP' });
        if (String(actor.getSnapshot().value) === current) {
          throw new Error(`The statechart stayed in ${current} after the capability of ${next} ran.`);
        }
      }
      const rendered = this.etl.read(AnnotationSurfaceGenerationMachine.NAME, requestId, AnnotationSurfaceGenerationMachine.FINAL_STATE);
      return (rendered?.result as { image: DocumentImage }).image;
    } finally {
      actor.stop();
      this.etl.clear(AnnotationSurfaceGenerationMachine.NAME, requestId);
    }
  }

  private async runCapability(requestId: string, state: AnnotationSurfaceGenerationStateValue): Promise<void> {
    const id = `${AnnotationSurfaceGenerationMachine.CAPABILITY_ID_PREFIX}${state}`;
    const capability = await this.capabilityFor(id);
    await new capability().execute({
      requestId,
      state,
      machine: AnnotationSurfaceGenerationMachine.NAME,
      etl: this.etl,
      parameters: { document: this.request.document },
    });
  }

  private async capabilityFor(id: string): Promise<CapabilityClass> {
    for (const load of Object.values(capabilityImports)) {
      for (const exported of Object.values(await load())) {
        const metadata = (exported as { METADATA?: { id?: unknown } } | undefined)?.METADATA;
        if (typeof exported === 'function' && metadata?.id === id) return exported as CapabilityClass;
      }
    }
    throw new Error(`Annotation surface capability not found: ${id}`);
  }
}
