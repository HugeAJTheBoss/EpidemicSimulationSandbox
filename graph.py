# save as show_both_graphs.py
import networkx as nx
import random
from pyvis.network import Network
import webbrowser
import os

def create_random_2_regular(n, d=2):
    # networkx ensures n*d is even; for d=2 this is always okay if n>=3
    return nx.random_regular_graph(d=d, n=n)

def connect_neighbors(G,n):
    """
    Given a graph G, return a new graph H where:
      - Each node keeps at least one of its old edges (so no isolation).
      - Each node connects at most one pair of its neighbors.
      - No duplicate neighbor connections are added.
    This prevents edge counts from exploding across iterations.
    """
    H = nx.Graph()
    H.add_nodes_from(G.nodes())

    for node in G.nodes():
        neighbors = list(G.neighbors(node))
        if len(neighbors) == 0:
            continue

        if len(neighbors) == 1:
            # must keep its only neighbor
            H.add_edge(node, neighbors[0])
        else:
            # choose 2 neighbors
            chosen = random.sample(neighbors, 2)
            # connect node to them
            for c in chosen:
                H.add_edge(node, c)
            # ALSO connect them together
            H.add_edge(chosen[0], chosen[1])

    return H

    return H
def add_node_with_connections(G, num_connections=3):
    """
    Add a new node to graph G with 'num_connections' random edges
    to existing nodes.
    """
    H = G.copy()

    # assign a new node id (max id + 1)
    if len(H.nodes) == 0:
        new_node = 0
    else:
        new_node = max(H.nodes) + 1

    H.add_node(new_node)

    # pick random distinct nodes to connect with
    if len(H.nodes) - 1 >= num_connections:
        targets = random.sample(list(H.nodes - {new_node}), num_connections)
    else:
        targets = list(H.nodes - {new_node})  # connect to all if fewer available

    # add edges
    for t in targets:
        H.add_edge(new_node, t)

    return H
def pyvis_from_nx(G, title="Graph", height="500px", width="100%"):
    """
    Create a pyvis Network from a networkx graph.
    Labels each node with its ID shown on the node.
    """
    net = Network(
        notebook=False,
        height=height,
        width=width,
        bgcolor="white",
        font_color="black"
    )

    # Add nodes with centered labels
    for node in G.nodes():
        net.add_node(
            node,
            label=str(node),
            shape="circle",             
            font={"multi": "html", "vadjust": 0} 
        )

    # Add edges
    for u, v in G.edges():
        net.add_edge(u, v)

    # Disable edge smoothing (make lines stay straight when dragging)
    net.set_options("""
    {
      "edges": {
        "smooth": false
      },
      "physics": {
        "enabled": false
      }
    }
    """)

    return net

def write_multi_graph_html(graphs, out_index="index.html", columns_per_row=1):
    """
    graphs : list of dicts with keys 'file', 'title', 'edges'
    """
    panes_html = ""
    labels_html = ""

    for i, g in enumerate(graphs):
        panes_html += f'<div class="pane-container"><iframe width="100%" class="pane" src="{g["file"]}" title="{g["title"]}"></iframe></div>\n'
        labels_html += f'<div class="label">{g["title"]} — Edges: {g["edges"]}</div>\n'

    html = f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Graphs</title>
    <style>
      body {{ margin:0; padding:0; font-family: Arial, sans-serif; }}
      .labels {{
        display: grid;
        grid-template-columns: repeat({columns_per_row}, 1fr);
        gap: 10px;
        padding: 10px;
        background-color: #f5f5f5;
        border-bottom: 1px solid #ddd;
      }}
      .label {{ 
        padding: 6px 12px; 
        font-weight: bold; 
        text-align: center;
        background-color: white;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }}
      .container {{ 
        display: grid;
        grid-template-columns: repeat({columns_per_row}, 1fr);
        grid-auto-rows: 500px;
        gap: 10px;
        padding: 10px;
      }}
      .pane-container {{
        display: flex;
        flex-direction: column;
        width: 100%;
      }}
      .pane {{ 
        flex: 1;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      }}
    </style>
  </head>
  <body>
    <div class="labels">
      {labels_html}
    </div>
    <div class="container">
      {panes_html}
    </div>
  </body>
</html>
"""
    with open(out_index, "w", encoding="utf-8") as f:
        f.write(html)
    return out_index

def main():
    out_dir = "graphs_out"
    os.makedirs(out_dir, exist_ok=True)
    os.chdir(out_dir)  # write files into this directory

    num_nodes = 126
    num_graphs = 1

    # 1) Create sequence of graphs
    graphs = [create_random_2_regular(n=num_nodes, d=3)]
    for i in range(1, num_graphs):
        # connect_neighbors accepts an optional second arg, so this call is safe
        graphs.append(connect_neighbors(graphs[i-1], i))

    # 2) create pyvis networks and write each to file
    graphDicts = []
    for i, G in enumerate(graphs):
        filename = f"graph_{i}.html"
        net = pyvis_from_nx(G, title=f"Graph: {i}", height="500px", width="100%")
        net.write_html(filename)   # <--- important: write the per-graph HTML
        graphDicts.append({"file": filename, "title": f"{i}", "edges": G.number_of_edges()})

    # 3) write index that shows all graphs (in same folder)
    index_file = "index.html"
    write_multi_graph_html(graphDicts, out_index=index_file, columns_per_row=3)

    # 4) open index
    path = os.path.abspath(index_file)
    print("Wrote", len(graphDicts), "graph files and index at", path)
    webbrowser.open("file://" + path)

if __name__ == "__main__":
    main()
