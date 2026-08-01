import argparse
import asyncio
import logging
import signal
from contextlib import suppress

from app.config import get_settings
from app.convex_gateway import HttpConvexGateway
from app.dispatcher import Dispatcher
from app.executor import DisabledExecutor, E2BExecutor


def build_dispatcher() -> tuple[Dispatcher, float]:
    settings = get_settings()
    gateway = HttpConvexGateway(settings)
    executor = E2BExecutor(settings) if settings.execution_mode == "e2b" else DisabledExecutor()
    return Dispatcher(settings, gateway, executor), settings.dispatcher_poll_seconds


async def run_once() -> None:
    dispatcher, _ = build_dispatcher()
    result = await dispatcher.dispatch_once()
    logging.info("dispatcher_result status=%s run_id=%s step_id=%s", result.status, result.run_id, result.step_id)


async def run_forever() -> None:
    dispatcher, poll_seconds = build_dispatcher()
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for name in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(name, stop.set)

    while not stop.is_set():
        try:
            result = await dispatcher.dispatch_once()
            if result.status != "idle":
                logging.info(
                    "dispatcher_result status=%s run_id=%s step_id=%s",
                    result.status,
                    result.run_id,
                    result.step_id,
                )
        except Exception:
            logging.exception("dispatcher_iteration_failed")
        with suppress(TimeoutError):
            await asyncio.wait_for(stop.wait(), timeout=poll_seconds)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Run one dispatcher iteration and exit")
    arguments = parser.parse_args()
    asyncio.run(run_once() if arguments.once else run_forever())
