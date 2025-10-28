#!/usr/bin/env python3
import requests
import sys
import argparse


def main():
    parser = argparse.ArgumentParser(description='Simple backend ping test')
    parser.add_argument('--port', '-p', type=int, default=5001, help='port where backend is running')
    args = parser.parse_args()

    url = f'http://localhost:{args.port}/api/ping'
    try:
        r = requests.get(url, timeout=3)
        print('status', r.status_code)
        try:
            print(r.json())
        except Exception:
            # print raw text if not JSON
            print(r.text)
    except Exception as e:
        print('Error connecting to backend:', e)
        sys.exit(1)


if __name__ == '__main__':
    main()
