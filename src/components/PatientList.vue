<template>
  <div class="patients">
    <h2>Patient List</h2>
    <ul>
      <li v-for="p in patients" :key="p.id">
        <button @click="openModal(p)">
          {{ p.firstName }} {{ p.lastName }}
        </button>
      </li>
    </ul>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div style="margin:20px">
            <button class="close-btn" @click="closeModal">✕</button>
            <button class="print-btn" @click="downloadPDF">Download PDF</button>
        </div>
       
        <canvas ref="modalCanvas" class="fabric-canvas"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { fabric }       from 'fabric'
import {base64 as rawBase64} from '../assets/pdf/pdfBase64'
import { jsPDF } from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist/build/pdf'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// tell PDF.js where to find the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker

const base64 = ref(rawBase64)


// your patient data (replace base64 with real PDF data)
const patients = [
  {
    id: 1,
    firstName: 'Alice',
    lastName:  'Smith',
    fullName: 'Alice Smith',
    age:        28,
    city: 'Ontario',
    phone: '(333) - 555 - 6666',
    ohip: 'OHIP -3442345',
    dob : '1990-12-12',
  },
  {
    id: 2,
    firstName: 'Bob',
    lastName:  'Jones',
    fullName: 'Bob Jones',
    age:        45,
    city: 'Ontario',
    phone: '(888) - 555 - 6666',
    ohip: 'OHIP - 6666666',
    dob : '1990-01-12',
  }
]

const showModal       = ref(false)
const activePatient   = ref(null)
const modalCanvas     = ref(null)
let modalCanvasInst   = null

function closeModal() {
  showModal.value = false
  // dispose Fabric canvas to clean up listeners
  modalCanvasInst?.dispose()
  modalCanvasInst = null
}

// when user clicks a patient, open modal and render PDF + fields
async function openModal(p) {
  activePatient.value = p
  showModal.value   = true

  await nextTick()
  // init Fabric on the canvas inside the modal
  modalCanvasInst = new fabric.Canvas(modalCanvas.value, {
    selection: true,
    preserveObjectStacking: true
  })
  modalCanvasInst.lowerCanvasEl.style.zIndex = '0'
  modalCanvasInst.upperCanvasEl.style.zIndex = '1'

  renderModalPDF(p)
}

async function renderModalPDF(p) {
  const bytes = Uint8Array.from(atob(base64.value), c => c.charCodeAt(0))
  const pdf   = await pdfjsLib.getDocument({ data: bytes }).promise
  const page  = await pdf.getPage(1)
  const vp    = page.getViewport({ scale: 1.5 })

  const off = document.createElement('canvas')
  off.width  = vp.width
  off.height = vp.height
  await page.render({
    canvasContext: off.getContext('2d'),
    viewport: vp
  }).promise

  modalCanvasInst.setWidth(vp.width)
  modalCanvasInst.setHeight(vp.height)

  fabric.Image.fromURL(off.toDataURL(), img => {
    img.set({ originX: 'left', originY: 'top' })
    modalCanvasInst.setBackgroundImage(
      img,
      modalCanvasInst.renderAll.bind(modalCanvasInst),
      { scaleX: 1, scaleY: 1 }
    )
    injectSavedFields(p)
  })
}

// load saved fields from localStorage and inject patient data
function injectSavedFields(p) {
  const raw = localStorage.getItem(`sample_pdf`)
  if (!raw) return

  let data
  try {
    data = JSON.parse(raw).objects
  } catch {
    console.error('Invalid saved data')
    return
  }

  data.forEach(o => {
    // only inject if patient has that property
    if (p[o.placeholder] == null) return
    const text = new fabric.Textbox(p[o.placeholder], {
      left: o.left,
      top:  o.top,
      width:  o.width,
      height: o.height,
      fontSize: 16,
      hasControls: false,
      hasBorders:  false,
      selectable:  false,
      editable:    false
    })
    text.setCoords()
    modalCanvasInst.add(text)
  })

  modalCanvasInst.renderAll()
}

function downloadPDF() {
  if (!modalCanvasInst) return

  // 1) Get the canvas as a PNG data-url
  const imgData = modalCanvasInst.toDataURL({
    format: 'png',
    // You can bump multiplier if you need higher resolution
   multiplier: 2
  })

  // 2) Create a jsPDF sized to the canvas dimensions (in px)
  const widthPx  = modalCanvasInst.getWidth() * 1  // match multiplier
  const heightPx = modalCanvasInst.getHeight() * 1
  const pdf = new jsPDF({
   orientation: widthPx > heightPx ? 'l' : 'p',
   unit: 'px',
    format: [ widthPx, heightPx ]
  })

 // 3) Add the image to the PDF at full size (0,0)
  pdf.addImage(imgData, 'PNG', 0, 0, widthPx, heightPx)

  // 4) Trigger the download, naming it like "alice_smith.pdf"
  const filename = `sample.pdf`
  pdf.save(filename)
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
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.4);
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
  top: 8px; right: 8px;
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
