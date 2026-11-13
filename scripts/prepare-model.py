"""Prepare licensed concept: retain full model as gzip; create a lightweight software-rendering LOD."""
from pathlib import Path
import gzip, trimesh, json, numpy as np
root=Path(__file__).resolve().parents[1]
p=root/'dist/models/car.glb'
import io
source=p.read_bytes() if p.exists() else gzip.decompress((root/'dist/models/car.glb.gz').read_bytes())
scene=trimesh.load(io.BytesIO(source),file_type='glb',force='scene')
total=sum(len(g.faces) for g in scene.geometry.values())
print('Source triangles',total,flush=True)
out=trimesh.Scene()
for node in scene.graph.nodes_geometry:
    transform,name=scene.graph[node];mesh=scene.geometry[name]
    mesh=mesh.copy();mesh.merge_vertices(merge_norm=True,merge_tex=True)
    target=max(40,int(len(mesh.faces)/total*6500))
    # A closed silhouette proxy avoids holes and T-junction artifacts in SVG.
    # The full source remains the WebGL asset; this LOD intentionally loses cavities.
    reduced=mesh.convex_hull
    if len(reduced.faces)>target:reduced=reduced.simplify_quadric_decimation(face_count=target)
    reduced.visual=mesh.visual.copy() if len(reduced.faces)==len(mesh.faces) else trimesh.visual.ColorVisuals(reduced,face_colors=[195,38,30,255] if any(x in node.lower() for x in ['body','chassis','nose','wing','sidepod','cover']) else [43,50,57,255])
    print(node,len(mesh.faces),len(reduced.faces),flush=True)
    out.add_geometry(reduced,node_name=node,geom_name=node,transform=transform)
(root/'dist/models/car-preview.glb').write_bytes(out.export(file_type='glb'))
(root/'dist/models/car.glb.gz').write_bytes(gzip.compress(source,compresslevel=7))
print('Preview triangles',sum(len(g.faces) for g in out.geometry.values()),flush=True)
