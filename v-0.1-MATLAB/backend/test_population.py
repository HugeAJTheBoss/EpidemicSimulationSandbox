import requests
import sys

def main():
    port = 5001
    url = f'http://localhost:{port}/api/run_population'
    try:
        r = requests.post(url, json={'rows': 5, 'cols': 6}, timeout=5)
    except Exception as e:
        print('ERROR: request failed', e)
        sys.exit(2)

    print('status', r.status_code)
    try:
        j = r.json()
    except Exception as e:
        print('ERROR: invalid json', e)
        print('body:', r.text)
        sys.exit(2)

    if not j.get('success'):
        print('ERROR: success flag false', j)
        sys.exit(2)

    res = j.get('result')
    if not res:
        print('ERROR: missing result', j)
        sys.exit(2)

    rows = res.get('rows')
    cols = res.get('cols')
    pop = res.get('population')

    print('rows', rows, 'cols', cols)
    if not isinstance(pop, list) or not isinstance(pop[0], list):
        print('ERROR: population is not 2D array', type(pop), pop)
        sys.exit(2)

    # quick shape check
    if len(pop) != rows or any(len(rw) != cols for rw in pop):
        print('ERROR: population shape mismatch', len(pop), [len(rw) for rw in pop])
        sys.exit(2)

    print('OK: population 2D array present')

if __name__ == '__main__':
    main()
