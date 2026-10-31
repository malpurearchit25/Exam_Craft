#!/usr/bin/env python3
"""Launch the offline ExamCraft browser app using only Python's standard library."""
from argparse import ArgumentParser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import webbrowser


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000, help='Local port (default: 8000; 0 chooses a free port)')
    parser.add_argument('--no-browser', action='store_true', help='Print the address without opening a browser')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('port must be between 0 and 65535')
    root = Path(__file__).resolve().parent / 'dist'
    if not (root / 'index.html').is_file():
        parser.error('dist/index.html is missing. Extract the complete project archive first.')
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        parser.exit(1, f'Could not start ExamCraft: {error}\nTry python3 run.py --port 8001\n')
    address = f'http://127.0.0.1:{server.server_port}/'
    print(f'ExamCraft is running at {address}\nPress Ctrl+C to stop.', flush=True)
    if not args.no_browser:
        opener = threading.Timer(0.3, webbrowser.open, args=(address,))
        opener.daemon = True
        opener.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nExamCraft stopped.')
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
