# Exporta del modelo FreeCAD del DOMI CORE lo que la web necesita y el visor del kit no tiene al día:
#   · la carcasa dividida en tapa (canto redondeado superior) y cuerpo, para el configurador de colores;
#   · la carcasa entera (para el visor de estudio);
#   · toda pieza cuya posición o forma cambió respecto del visor del kit (por ejemplo, el símbolo de la tapa
#     cuando la carcasa se hace más alta).
# Trabaja sobre una copia temporal: el archivo original no se modifica.
#
#   "C:\Program Files\FreeCAD 1.1\bin\freecadcmd.exe" tools/exportar_core.py      (desde la carpeta del proyecto)
#
# Salida: cad_fuente/core_cad.json (coordenadas FreeCAD, mm)
import json, os, shutil, tempfile, base64, array
import FreeCAD as App
import Part

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")) if "__file__" in globals() else os.getcwd()
KIT = os.environ.get("DOMI_KIT", r"C:\Users\Matias\Downloads\DOMI_Kit_Presentacion\DOMI_Kit_Presentacion")
SRC = os.environ.get("DOMI_CORE_FCSTD", r"C:\Users\Matias\Downloads\UCP_SR_2026_A_AE2_Villalba, Alejandro Matias_Modelo_01_FreeCAD.FCStd")
COPIA = os.path.join(tempfile.gettempdir(), "core_copia_web.FCStd")
OUT = os.path.join(RAIZ, "cad_fuente", "core_cad.json")
CANTO = 3.5          # radio del canto superior: la tapa empieza 3,5 mm debajo del techo
# ejes del visor del kit: three (x, y, z) = FreeCAD (x - 57,5, z, 52,5 - y)
OFF_X, OFF_Z = -57.5, 52.5


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
            if g.dot(nrm[a] + nrm[b] + nrm[c]) < 0:
                b, c = c, b
            I += [base + a, base + b, base + c]
    return {"pos": [round(x, 4) for x in P], "nrm": [round(x, 4) for x in N], "idx": I}


def caja_malla(pos):
    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    return [min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)]


# cajas de las piezas en el visor del kit, pasadas a coordenadas FreeCAD
man = json.load(open(os.path.join(KIT, "visor_3d", "core.json"), encoding="utf-8"))
buf = base64.b64decode(open(os.path.join(KIT, "visor_3d", "core.b64.txt")).read().strip())
kit = {}
for p in man["piezas"]:
    off, n = p["pos"]
    a = array.array("f"); a.frombytes(buf[off:off + n * 4])
    xs, ys, zs = a[0::3], a[1::3], a[2::3]
    kit[p["id"]] = [min(xs) - OFF_X, OFF_Z - max(zs), min(ys), max(xs) - OFF_X, OFF_Z - min(zs), max(ys)]

shutil.copyfile(SRC, COPIA)
doc = App.openDocument(COPIA)
carc = doc.getObject("Carcasa_unibody").Shape
bb = carc.BoundBox
z_corte = bb.ZMax - CANTO
caja_sup = Part.makeBox(bb.XLength + 20, bb.YLength + 20, 50, App.Vector(bb.XMin - 10, bb.YMin - 10, z_corte))
tapa = carc.common(caja_sup).removeSplitter()
cuerpo = carc.cut(caja_sup).removeSplitter()

cambiadas = {}
for o in doc.Objects:
    if o.TypeId != "Part::Feature" or o.Name == "Carcasa_unibody" or o.Name not in kit:
        continue
    m = malla(o.Shape, 0.02)
    c = caja_malla(m["pos"])
    if max(abs(x - y) for x, y in zip(c, kit[o.Name])) > 0.05:
        cambiadas[o.Name] = m
        print("pieza cambiada:", o.Name, [round(x, 2) for x in c])

res = {"fuente": os.path.basename(SRC), "alto": round(bb.ZMax, 3), "z_corte": z_corte,
       "tapa": malla(tapa), "cuerpo": malla(cuerpo), "carcasa": malla(carc),
       "validez": {"tapa": tapa.isValid(), "cuerpo": cuerpo.isValid()},
       "volumen": {"carcasa": carc.Volume, "tapa": tapa.Volume, "cuerpo": cuerpo.Volume},
       "piezas": cambiadas}
App.closeDocument(doc.Name)
json.dump(res, open(OUT, "w"))
print("OK alto %.2f mm · corte en %.2f mm · volúmenes %.2f + %.2f = %.2f (carcasa %.2f) · piezas cambiadas: %s" % (
    res["alto"], z_corte, tapa.Volume, cuerpo.Volume, tapa.Volume + cuerpo.Volume, carc.Volume, list(cambiadas)))
