import EventEmitter from "events";
import type { EventPayloadMap } from "./event.types.js";
import { logger } from "../core/logger/index.js";

type EventName = keyof EventPayloadMap;
type EventHandler<K extends EventName> = (payload: EventPayloadMap[K]) => void | Promise<void>;

const logEventHandlerError = (event: string, error: unknown): void => {
	if (error instanceof Error) {
		logger.error("Event handler failed", {
			event,
			errorMessage: error.message,
			errorStack: error.stack,
		});
		return;
	}

	logger.error("Event handler failed", {
		event,
		error,
	});
};

class EventBus extends EventEmitter {
	override on<K extends EventName>(event: K, listener: EventHandler<K>): this {
		const wrappedListener = (payload: EventPayloadMap[K]): void => {
			try {
				const result = listener(payload);
				if (result instanceof Promise) {
					void result.catch((error: unknown) => {
						logEventHandlerError(String(event), error);
					});
				}
			} catch (error) {
				logEventHandlerError(String(event), error);
				throw error;
			}
		};

		return super.on(event, wrappedListener as (...args: unknown[]) => void);
	}

	override emit<K extends EventName>(event: K, payload: EventPayloadMap[K]): boolean {
		return super.emit(event, payload);
	}
}

export const eventBus = new EventBus();
