<template>
  <div class="patients">
    <h2>Patient List</h2>
    <ul>
      <li v-for="p in patients" :key="p.id" style="color: black">
        <button @click="openModal(p)" style="color: black">
          {{ p.firstName }} {{ p.lastName }}
        </button>
      </li>
    </ul>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div style="margin: 20px">
          <button class="close-btn" @click="closeModal" style="color: black">
            ✕
          </button>
          <button class="print-btn" @click="downloadPDF" style="color: black">
            Download PDF
          </button>
        </div>

        <canvas ref="modalCanvas" class="fabric-canvas"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { fabric } from "fabric";
import { base64 as rawBase64 } from "../assets/pdf/pdfBase64";
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// tell PDF.js where to find the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

const base64 = ref(rawBase64);

const BASE = 20; // the size the check path was designed for
const CHECK_PATH = "M -6 0 L -2 6 L 8 -8"; // centered path (around 0,0)

// your patient data (replace base64 with real PDF data)
const patients = [
  {
    id: 1,
    firstName: "Alice",
    lastName: "Smith",
    fullName: "Alice Smith",
    age: 28,
    city: "Ontario",
    phone: "(333) - 555 - 6666",
    ohip: "OHIP -3442345",
    dob: "1990-12-12",
  },
  {
    id: 2,
    firstName: "Bob",
    lastName: "Jones",
    fullName: "Bob Jones",
    age: 45,
    city: "Ontario",
    phone: "(888) - 555 - 6666",
    ohip: "OHIP - 6666666",
    dob: "1990-01-12",
  },
];

const showModal = ref(false);
const activePatient = ref(null);
const modalCanvas = ref(null);
let modalCanvasInst = null;

function closeModal() {
  showModal.value = false;
  // dispose Fabric canvas to clean up listeners
  modalCanvasInst?.dispose();
  modalCanvasInst = null;
}

// when user clicks a patient, open modal and render PDF + fields
async function openModal(p) {
  activePatient.value = p;
  showModal.value = true;

  await nextTick();
  // init Fabric on the canvas inside the modal
  modalCanvasInst = new fabric.Canvas(modalCanvas.value, {
    selection: true,
    preserveObjectStacking: true,
  });
  modalCanvasInst.lowerCanvasEl.style.zIndex = "0";
  modalCanvasInst.upperCanvasEl.style.zIndex = "1";

  renderModalPDF(p);
}

async function renderModalPDF(p) {
  const bytes = Uint8Array.from(atob(base64.value), (c) => c.charCodeAt(0));
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: 1.5 });

  const off = document.createElement("canvas");
  off.width = vp.width;
  off.height = vp.height;
  await page.render({
    canvasContext: off.getContext("2d"),
    viewport: vp,
  }).promise;

  modalCanvasInst.setWidth(vp.width);
  modalCanvasInst.setHeight(vp.height);

  fabric.Image.fromURL(off.toDataURL(), (img) => {
    img.set({ originX: "left", originY: "top" });
    modalCanvasInst.setBackgroundImage(
      img,
      modalCanvasInst.renderAll.bind(modalCanvasInst),
      { scaleX: 1, scaleY: 1 }
    );
    injectSavedFields(p);
  });
}

function createReadonlyText({ left, top, width, height, text }) {
  const tb = new fabric.Textbox(String(text ?? ""), {
    left,
    top,
    width: width || 150,
    height: height || 30,
    fontSize: 16,
    editable: false,
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
  });
  // hard lock position
  tb.lockMovementX = true;
  tb.lockMovementY = true;
  return tb;
}
function createCheckboxFill({
  left,
  top,
  size = 18,
  checked = false,
  fieldName = "checkbox",
}) {
  const box = new fabric.Rect({
    originX: "center",
    originY: "center",
    width: size,
    height: size,
    rx: Math.min(4, size / 5),
    ry: Math.min(4, size / 5),
    stroke: "#000",
    fill: "#fff",
    strokeUniform: true, // border thickness stays consistent when scaling
    selectable: false,
    evented: false,
    objectCaching: false,
  });

  const tick = new fabric.Path(CHECK_PATH, {
    originX: "center",
    originY: "center",
    stroke: "#000",
    fill: null,
    strokeWidth: 2,
    visible: !!checked,
    name: "checkmark",
    selectable: false,
    evented: false,
    objectCaching: false,
    // strokeUniform: false  // (default) lets the tick stroke scale with size
  });

  // scale tick to match current size
  const s = size / BASE;
  tick.scaleX = s;
  tick.scaleY = s;

  const group = new fabric.Group([box, tick], {
    left,
    top,
    hasControls: false,
    hasBorders: false, // in patient fill view
    selectable: true,
    hoverCursor: "pointer",
    lockMovementX: true,
    lockMovementY: true,
    lockScalingFlip: true,
    lockUniScaling: true, // if you later enable resize in editor
    fieldType: "checkbox",
    fieldName,
    checked: !!checked,
    objectCaching: false,
  });

  // toggle on click
  group.on("mousedown", () => {
    group.checked = !group.checked;
    tick.visible = group.checked;
    group.dirty = true;
    group.canvas?.requestRenderAll();
  });

  // If you let authors resize in the editor, this keeps it square and centered
  group.on("scaling", () => {
    const u = Math.max(group.scaleX, group.scaleY);
    group.scaleX = group.scaleY = u; // enforce uniform scale
  });
  group.on("modified", () => {
    // keep children centered after any transform
    tick.set({ left: 0, top: 0 });
    box.set({ left: 0, top: 0 });
    group.addWithUpdate();
    group.canvas?.requestRenderAll();
  });

  return group;
}
// Patient modal: fixed-size, typeable, with hard overflow guard
// Patient modal: fixed-size, typeable, hard-clipped & overflow-guarded
function createFreeTextFill({ left, top, width = 500, height = 500 }) {
  const PAD = 12;

  // 1) Background & border (covers PDF underneath)
  const frame = new fabric.Rect({
    originX: "left",
    originY: "top",
    left: 0,
    top: 0,
    width,
    height,
    fill: "#fff",
    stroke: "#000",
    strokeWidth: 1,
    selectable: false,
    evented: false,
    objectCaching: false,
  });

  // 2) Editable text box
  const innerW = Math.max(20, width - PAD * 2);
  const innerH = Math.max(10, height - PAD * 2);

  const tb = new fabric.Textbox("", {
    originX: "left",
    originY: "top",
    left: PAD,
    top: PAD,
    width: innerW,
    fontSize: 16,
    lineHeight: 1.2,
    fill: "#000",
    editable: true,
    selectable: true,
    hasControls: false,
    hasBorders: false,
    objectCaching: false,
    hoverCursor: "text",
    // This forces wrapping even for very long words (no space)
    splitByGrapheme: true,
  });

  // 3) Visual hard-clip: nothing can render outside inner box
  // clipPath for a Textbox is relative to its center (when absolutePositioned=false).
  // So use origin center and size = innerW x innerH.
  tb.clipPath = new fabric.Rect({
    originX: "center",
    originY: "center",
    width: innerW,
    height: innerH,
    absolutePositioned: false, // default; keep it relative to tb
  });

  // 4) Overflow guard: block new input once content would exceed innerH.
  let guard = false;
  let lastText = "";
  let lastSelStart = 0;
  let lastSelEnd = 0;

  function snapshot() {
    lastText = tb.text || "";
    lastSelStart = tb.selectionStart || 0;
    lastSelEnd = tb.selectionEnd || lastSelStart;
  }
  snapshot();

  tb.on("changed", () => {
    if (guard) return;

    // If it fits, remember this good state
    if (tb.height <= innerH) {
      snapshot();
      tb.canvas?.requestRenderAll();
      return;
    }

    // Would overflow -> revert the change (typing or paste)
    guard = true;
    tb.text = lastText;
    tb.setSelectionStart(lastSelStart);
    tb.setSelectionEnd(lastSelEnd);
    guard = false;
    tb.canvas?.requestRenderAll();
  });

  // 5) Group wrapper (locks movement/size)
  const group = new fabric.Group([frame, tb], {
    originX: "left",
    originY: "top",
    left,
    top,
    hasControls: false,
    hasBorders: true, // shows selection outline
    selectable: true,
    hoverCursor: "text",
    lockMovementX: true,
    lockMovementY: true,
    objectCaching: false,
    fieldType: "free-text",
  });

  // Single-click to start typing
  group.on("mousedown", () => {
    if (!tb.isEditing) tb.enterEditing();
  });

  return group;
}

// load saved fields from localStorage and inject patient data
// function injectSavedFields(p) {
//   const raw = localStorage.getItem(`sample_pdf`)
//   if (!raw) return

//   let data
//   try {
//     data = JSON.parse(raw).objects
//   } catch {
//     console.error('Invalid saved data')
//     return
//   }

//   data.forEach(o => {
//     // only inject if patient has that property
//     if (p[o.placeholder] == null) return
//     const text = new fabric.Textbox(p[o.placeholder], {
//       left: o.left,
//       top:  o.top,
//       width:  o.width,
//       height: o.height,
//       fontSize: 16,
//       hasControls: false,
//       hasBorders:  false,
//       selectable:  false,
//       editable:    false
//     })
//     text.setCoords()
//     modalCanvasInst.add(text)
//   })

//   modalCanvasInst.renderAll()
// }

function injectSavedFields(p) {
  const raw = localStorage.getItem("sample_pdf");
  if (!raw) return;

  let objects = [];
  try {
    const parsed = JSON.parse(raw);
    objects = parsed.objects || [];
  } catch (e) {
    console.error("Invalid saved data", e);
    return;
  }

  objects.forEach((o) => {
    // Backwards compatibility + defaults
    const fieldType = o.fieldType || "text";
    const fieldName = o.fieldName || o.placeholder || "field";
    const size = Math.max(12, Math.min(o.width || 18, o.height || 18));

    if (fieldType === "checkbox") {
      // Initial checked state can come from patient data or saved "checked"
      const initialChecked =
        (typeof p[fieldName] === "boolean" ? p[fieldName] : undefined) ??
        !!o.checked;

      const cb = createCheckboxFill({
        left: o.left,
        top: o.top,
        size,
        checked: initialChecked,
        fieldName,
      });
      modalCanvasInst.add(cb);
      return;
    }

    if (fieldType === "free-text") {
      const ft = createFreeTextFill({
        left: o.left,
        top: o.top,
        width: o.width || 200,
        height: o.height || 200,
      });
      modalCanvasInst.add(ft);
      return;
    }

    // Prefer patient value, else saved value, else fieldName
    const value =
      p[fieldName] != null
        ? p[fieldName]
        : o.value != null
        ? o.value
        : fieldName;

    const tb = createReadonlyText({
      left: o.left,
      top: o.top,
      width: o.width,
      height: o.height,
      text: value,
    });
    // keep metadata in case you need it later
    tb.set({ fieldName, fieldType: "text" });
    modalCanvasInst.add(tb);
  });

  // Canvas interaction: disable multi-select box, allow object events
  modalCanvasInst.selection = false;
  modalCanvasInst.skipTargetFind = false;
  modalCanvasInst.renderAll();
}

function downloadPDF() {
  if (!modalCanvasInst) return;

  // 1) Get the canvas as a PNG data-url
  const imgData = modalCanvasInst.toDataURL({
    format: "png",
    // You can bump multiplier if you need higher resolution
    multiplier: 2,
  });

  // 2) Create a jsPDF sized to the canvas dimensions (in px)
  const widthPx = modalCanvasInst.getWidth() * 1; // match multiplier
  const heightPx = modalCanvasInst.getHeight() * 1;
  const pdf = new jsPDF({
    orientation: widthPx > heightPx ? "l" : "p",
    unit: "px",
    format: [widthPx, heightPx],
  });

  // 3) Add the image to the PDF at full size (0,0)
  pdf.addImage(imgData, "PNG", 0, 0, widthPx, heightPx);

  // 4) Trigger the download, naming it like "alice_smith.pdf"
  const filename = `sample.pdf`;
  pdf.save(filename);
}
</script>

<style scoped>
.patients {
  padding: 1rem;
}
.patients ul {
  list-style: none;
  padding: 0;
}
.patients li + li {
  margin-top: 0.5rem;
}
.patients button {
  background: #fff;
  border: 1px solid #ccc;
  padding: 6px 12px;
  cursor: pointer;
}

/* modal overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  position: relative;
  background: #fff;
  padding: 1rem;
  border-radius: 4px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
}
.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
}
.fabric-canvas {
  border: 1px solid #ccc;
  display: block;
  cursor: default;
}
</style>
