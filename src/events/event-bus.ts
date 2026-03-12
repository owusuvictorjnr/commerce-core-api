import EventEmitter from "events";
import type { EventPayloadMap } from "./event.types.js";

type EventName = keyof EventPayloadMap;
type EventHandler<K extends EventName> = (payload: EventPayloadMap[K]) => void | Promise<void>;

class EventBus extends EventEmitter {
	override on<K extends EventName>(event: K, listener: EventHandler<K>): this {
		return super.on(event, listener as (...args: unknown[]) => void);
	}

	override emit<K extends EventName>(event: K, payload: EventPayloadMap[K]): boolean {
		return super.emit(event, payload);
	}
}

export const eventBus = new EventBus();
