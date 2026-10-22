# Exporta del modelo FreeCAD actual del DOMI CORE lo que la web necesita y el visor del kit no tiene al día.
# Compara pieza por pieza contra el modelo original del kit (el que generó visor_3d/core.json):
#   · piezas cambiadas (forma o posición) y piezas nuevas  -> malla, material y grupo;
#   · piezas quitadas                                       -> lista de ids;
#   · la carcasa, entera y dividida en tapa (canto superior) y cuerpo, para el configurador de colores;
#   · el nombre y el grupo de cada pieza tal como figuran en el CAD (para el visor de estudio).
# Trabaja sobre copias temporales: los archivos originales no se modifican.
#
#   "C:\Program Files\FreeCAD 1.1\bin\freecadcmd.exe" tools/exportar_core.py      (desde la carpeta del proyecto)
#
# Salida: cad_fuente/core_cad.json (coordenadas FreeCAD, mm)
import json, os, shutil, tempfile
import FreeCAD as App
import Part

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")) if "__file__" in globals() else os.getcwd()
KIT = os.environ.get("DOMI_KIT", r"C:\Users\Matias\Downloads\DOMI_Kit_Presentacion\DOMI_Kit_Presentacion")
NOMBRE = "UCP_SR_2026_A_AE2_Villalba, Alejandro Matias_Modelo_01_FreeCAD.FCStd"
SRC = os.environ.get("DOMI_CORE_FCSTD", os.path.join(r"C:\Users\Matias\Downloads", NOMBRE))
BASE = os.path.join(KIT, "modelos", "core_matias", NOMBRE)       # el modelo del que salió el visor del kit
OUT = os.path.join(RAIZ, "cad_fuente", "core_cad.json")
CANTO = 3.5          # radio del canto superior: la tapa empieza 3,5 mm debajo del techo

# material de las piezas nuevas o que cambiaron de material (las demás conservan el del kit)
MATERIAL = {
    "RPi4_SoC_IHS": {"kind": "plastico", "color": [0.055, 0.057, 0.065]},      # encapsulado moldeado, sin tapa metálica
    "eMMC_modulo": {"kind": "pcb", "color": [0.0902, 0.4, 0.1882]},
    "eMMC_chip": {"kind": "plastico", "color": [0.0431, 0.0431, 0.051]},
    "eMMC_conector": {"kind": "plastico", "color": [0.0431, 0.0431, 0.051]},
}


def malla(shape, tol=0.02):
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


def abrir(ruta, alias):
    copia = os.path.join(tempfile.gettempdir(), alias)
    shutil.copyfile(ruta, copia)
    return App.openDocument(copia)


def firma(o):
    b = o.Shape.BoundBox
    return [b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax, o.Shape.Volume, len(o.Shape.Solids)]


def grupo(o):
    for g in o.InList:
        if g.TypeId == "App::DocumentObjectGroup":
            return g.Label
    return ""


base = abrir(BASE, "core_base_kit.FCStd")
antes = {o.Name: firma(o) for o in base.Objects if o.TypeId == "Part::Feature"}
App.closeDocument(base.Name)

doc = abrir(SRC, "core_copia_web.FCStd")
piezas = [o for o in doc.Objects if o.TypeId == "Part::Feature"]
cambiadas, nuevas, nombres = {}, {}, {}
for o in piezas:
    nombres[o.Name] = {"label": o.Label, "grupo": grupo(o)}
    if o.Name == "Carcasa_unibody":
        continue
    if o.Name not in antes:
        nuevas[o.Name] = dict(malla(o.Shape), **MATERIAL.get(o.Name, {}), grupo=grupo(o))
        print("pieza nueva:", o.Name)
    elif max(abs(a - b) for a, b in zip(firma(o), antes[o.Name])) > 0.01:
        cambiadas[o.Name] = dict(malla(o.Shape), **MATERIAL.get(o.Name, {}))
        print("pieza cambiada:", o.Name)
quitadas = sorted(set(antes) - {o.Name for o in piezas})
print("piezas quitadas:", quitadas)

carc = doc.getObject("Carcasa_unibody").Shape
bb = carc.BoundBox
z_corte = bb.ZMax - CANTO
caja_sup = Part.makeBox(bb.XLength + 20, bb.YLength + 20, 50, App.Vector(bb.XMin - 10, bb.YMin - 10, z_corte))
tapa = carc.common(caja_sup).removeSplitter()
cuerpo = carc.cut(caja_sup).removeSplitter()
res = {"fuente": os.path.basename(SRC), "alto": round(bb.ZMax, 3), "z_corte": z_corte,
       "tapa": malla(tapa, 0.025), "cuerpo": malla(cuerpo, 0.025), "carcasa": malla(carc, 0.025),
       "validez": {"tapa": tapa.isValid(), "cuerpo": cuerpo.isValid()},
       "volumen": {"carcasa": carc.Volume, "tapa": tapa.Volume, "cuerpo": cuerpo.Volume},
       "piezas": cambiadas, "nuevas": nuevas, "quitadas": quitadas, "nombres": nombres}
App.closeDocument(doc.Name)
json.dump(res, open(OUT, "w"))
print("OK alto %.2f mm · corte en %.2f mm · volúmenes %.2f + %.2f = %.2f (carcasa %.2f)" % (
    res["alto"], z_corte, tapa.Volume, cuerpo.Volume, tapa.Volume + cuerpo.Volume, carc.Volume))
