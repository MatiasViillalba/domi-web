# Separa la carcasa unibody del CORE en "tapa" (techo + canto redondeado) y "cuerpo"
# sobre una COPIA del modelo, y exporta ambas mallas con normales por cara.
#   freecadcmd tools/split_tapa.py      (desde la carpeta del proyecto; el original no se toca)
import json, os, shutil, sys, tempfile
import FreeCAD as App
import Part

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")) if "__file__" in globals() else os.getcwd()
KIT = os.environ.get("DOMI_KIT", r"C:\Users\Matias\Downloads\DOMI_Kit_Presentacion\DOMI_Kit_Presentacion")
SRC = os.path.join(KIT, "modelos", "core_matias", "UCP_SR_2026_A_AE2_Villalba, Alejandro Matias_Modelo_01_FreeCAD.FCStd")
COPIA = os.path.join(tempfile.gettempdir(), "core_copia_web.FCStd")
OUT = os.path.join(RAIZ, "cad_fuente", "core_tapa_split.json")
Z_CORTE = 41.5      # inicio del canto redondeado superior (45 - 3,5)

shutil.copyfile(SRC, COPIA)
doc = App.openDocument(COPIA)
carc = doc.getObject("Carcasa_unibody").Shape
bb = carc.BoundBox
caja_sup = Part.makeBox(bb.XLength + 20, bb.YLength + 20, 50, App.Vector(bb.XMin - 10, bb.YMin - 10, Z_CORTE))
tapa = carc.common(caja_sup).removeSplitter()
cuerpo = carc.cut(caja_sup).removeSplitter()


def malla(shape, tol=0.025):
    P, N, I = [], [], []
    for f in shape.Faces:
        try:
            pts, tris = f.tessellate(tol)
        except Exception:
            continue
        if not tris:
            continue
        base = len(P) // 3
        nrm = []
        for p in pts:
            try:
                u, v = f.Surface.parameter(p)
                n = f.normalAt(u, v)
            except Exception:
                n = App.Vector(0, 0, 1)
            nrm.append(n)
            P += [p.x, p.y, p.z]
        for n in nrm:
            N += [n.x, n.y, n.z]
        for a, b, c in tris:
            pa, pb, pc = pts[a], pts[b], pts[c]
            g = (pb - pa).cross(pc - pa)
            avg = nrm[a] + nrm[b] + nrm[c]
            if g.dot(avg) < 0:
                b, c = c, b
            I += [base + a, base + b, base + c]
    return {"pos": P, "nrm": N, "idx": I}


res = {"z_corte": Z_CORTE,
       "bbox_carcasa": [bb.XMin, bb.YMin, bb.ZMin, bb.XMax, bb.YMax, bb.ZMax],
       "tapa": malla(tapa), "cuerpo": malla(cuerpo),
       "validez": {"tapa": tapa.isValid(), "cuerpo": cuerpo.isValid()},
       "volumen": {"original": carc.Volume, "tapa": tapa.Volume, "cuerpo": cuerpo.Volume}}
App.closeDocument(doc.Name)
json.dump(res, open(OUT, "w"))
print("OK", res["validez"], {k: round(v, 2) for k, v in res["volumen"].items()},
      "tris tapa", len(res["tapa"]["idx"]) // 3, "tris cuerpo", len(res["cuerpo"]["idx"]) // 3)
