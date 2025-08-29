<template>

<div class="custom-fields">

  <div
    class="toolbox-item"
    draggable="true"
    @dragstart="startDrag($event, 'fullName')"
    >
    Add Full Name
  </div>

  <div 
    draggable = "true" 
    @dragstart="startDrag($event,'firstName')" 
    class="toolbox-item">
    Add First Name
  </div>
  <div
    class="toolbox-item"
    draggable="true"
    @dragstart="startDrag($event, 'lastName')"
    >
    Add Last Name
  </div>
  <div
    class="toolbox-item"
    draggable="true"
    @dragstart="startDrag($event, 'age')"
  >
    Add Age
  </div>

  <div
    class="toolbox-item"
    draggable="true"
    @dragstart="startDrag($event, 'city')"
  >
    Add City
  </div>

  <div
    class="toolbox-item"
    draggable="true"
    @dragstart="startDrag($event, 'phone')"
  >
    Add Phone
  </div>

  <div
    class="toolbox-item"
    draggable="true"
    @dragstart="startDrag($event, 'ohip')"
  >
    Add OHIP
  </div>

  <div
    class="toolbox-item"
    draggable="true"
    @dragstart="startDrag($event, 'age')"
  >
    Add Age
  </div>

  <div
    class="toolbox-item"
    draggable="true"
    @dragstart="startDrag($event, 'dob')"
  >
    Add DOB
  </div>

   <div
    class="toolbox-item"
    draggable="true"
    @dragstart="startDrag($event, 'consent')"
  >
    Add Consent Checkbox
  </div>

  <div
  class="toolbox-item"
  draggable="true"
  @dragstart="startDrag($event, 'freeText')"
>
  Add Free Text
</div>

</div>

<div  class="toolbox-item" @click="saveFabricObject">Save</div>
<div class="pdf-viewer">
    <canvas ref="fabricCanvas" class="fabric-canvas"></canvas>
</div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { fabric } from 'fabric'
import * as pdfjsLib from 'pdfjs-dist/build/pdf'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {base64 as rawBase64} from '../assets/pdf/pdfBase64'

const FIELD_SPECS = {
  // existing ones ...
  fullName:  { type: 'text' },
  firstName: { type: 'text' },
  lastName:  { type: 'text' },
  city:      { type: 'text' },
  age:       { type: 'number' },
  phone:     { type: 'number' },
  ohip:      { type: 'number' },
  dob:       { type: 'date' },

  // any boolean-like field becomes a checkbox placeholder
  consent:   { type: 'checkbox' },
   // NEW
   freeText:  { type: 'free-text', placeholder: 'Type here…' },
}

// tell PDF.js where to find the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker

const fabricCanvas = ref(null)
const base64 = ref(rawBase64)
// const canvasWrapperRef = ref(null)
let fabricCanvasInstance



// whenever base64 or page changes, re-render
const renderPDF = async () => {
  if (!base64.value) return

  // decode base64 to binary string
  const binary = atob(base64.value)

  // convert to Uint8Array
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const loadingTask = pdfjsLib.getDocument({ data: bytes })
  const pdf = await loadingTask.promise
  const pdfPage = await pdf.getPage(1)

  const viewport = pdfPage.getViewport({ scale: 1.5 })

  const off = document.createElement('canvas')
  // const ctx = pdfCanvas.value.getContext('2d')
off.width = viewport.width
  off.height = viewport.height
    await pdfPage.render({ canvasContext: off.getContext('2d'), viewport }).promise

  
  // Set fabric canvas to same dimensions
  if (fabricCanvasInstance) {
    fabricCanvasInstance.setDimensions({
      width: viewport.width,
      height: viewport.height
    })

    console.log('fabricCanvasInstance.calcOffset();: ',fabricCanvasInstance.calcOffset());

    // tell Fabric to re‑measure where the canvas lives in the page
    //fabricCanvasInstance.calcOffset();
      // redraw, just in case
   // fabricCanvasInstance.renderAll();
  }

  // 4) load that as Fabric background
  const dataUrl = off.toDataURL()
  fabric.Image.fromURL(dataUrl, img => {
    img.set({ originX: 'left', originY: 'top' })
    fabricCanvasInstance.setBackgroundImage(
      img,
      fabricCanvasInstance.renderAll.bind(fabricCanvasInstance),
      { scaleX: 1, scaleY: 1 }
    )
  })

}

onMounted(()=>{
  fabricCanvasInstance = new fabric.Canvas(fabricCanvas.value)

    const dropZone = fabricCanvasInstance.wrapperEl;
  
  // Debug: Log canvas creation
  console.log('Fabric canvas created:', fabricCanvasInstance)
  
  // Enable all interactions with explicit settings
  fabricCanvasInstance.selection = true
  fabricCanvasInstance.interactive = true
  fabricCanvasInstance.selectionBorderColor = '#4285f4'
  fabricCanvasInstance.selectionLineWidth = 2
  fabricCanvasInstance.selectionColor = 'rgba(66, 133, 244, 0.3)'
  fabricCanvasInstance.preserveObjectStacking = true
  
  // Add event listeners for debugging
  fabricCanvasInstance.on('object:added', (e) => {
    console.log('Object added:', e.target)
  })
  
  fabricCanvasInstance.on('selection:created', (e) => {
    console.log('Selection created:', e.selected)
  })
  
  fabricCanvasInstance.on('object:selected', (e) => {
    console.log('Object selected:', e.target)
  })

   fabricCanvasInstance.on('mouse:down', (e) => {
    console.log('Canvas clicked:', e)
    if (e.target) {
      console.log('Clicked on object:', e.target)
    } else {
      console.log('Clicked on empty canvas')
    }
 })

  dropZone.addEventListener('dragover',(e)=>{
    e.preventDefault()
  })

  dropZone.addEventListener('drop',(e)=>{
    e.preventDefault()
    const rect = dropZone.getBoundingClientRect()
    const dropX = e.clientX - rect.left
    const dropY = e.clientY - rect.top
    const fieldName = e.dataTransfer.getData('text/plain')

    if(!fieldName) return

    const spec = specFor(fieldName)

    console.log('feild. tpye: ',fieldName)

    let obj

    if (spec.type === 'checkbox') {
      obj = createCheckboxPlaceholder({ left: dropX, top: dropY, name: fieldName, placeholder: spec.placeholder })

    }else if (spec.type === 'free-text') {
    obj = createFreeTextEditor({ left: dropX, top: dropY, name: fieldName, placeholder: spec.placeholder })
  } else {
      obj = new fabric.Textbox(fieldName, {
        left: dropX,
        top: dropY,
        width: 150,
        height: 30,
        fontSize: 16,
        editable: true,
        selectable: true,
        hasControls: true,
        hasBorders: true
     })
     obj.set({ fieldName, fieldType: spec.type || 'text' })

    }

      

      obj.setCoords();    
     
     fabricCanvasInstance.add(obj)
               // ← update that text box’s corner coordinates
  //  fabricCanvasInstance.calcOffset(); // ← ensure canvas offset is fresh
     fabricCanvasInstance.setActiveObject(obj)
     fabricCanvasInstance.renderAll()
     
     // Force a re-render after a short delay
    //  setTimeout(() => {
    //    fabricCanvasInstance.renderAll()
    //    console.log('Active object after timeout:', fabricCanvasInstance.getActiveObject())
    //  }, 100)
   
 })
 
 // Add click event listener to canvas for debugging

 
 renderPDF()
})



const specFor = (name)=> {
  return FIELD_SPECS[name] || { type: 'text' }
}

const startDrag = (event,fieldName) => {
 event.dataTransfer.setData('text/plain',fieldName)
}

const saveFabricObject = () =>{



  const objects = fabricCanvasInstance.getObjects().map(o => {
    const scaledW = (typeof o.getScaledWidth  === 'function') ? o.getScaledWidth()  : (o.width || 0) * (o.scaleX || 1)
    const scaledH = (typeof o.getScaledHeight === 'function') ? o.getScaledHeight() : (o.height || 0) * (o.scaleY || 1)
 
    const base = {
      fieldName: o.fieldName || o.text || 'unknown',
      fieldType: o.fieldType || 'text',
      left: o.left,
      top: o.top,
      width: scaledW,
      height: scaledH,
    }
    if (base.fieldType === 'checkbox') {
      return { ...base, checked: !!o.checked }
    } else {
      return { ...base, value: o.text || '' }
    }
  })

  localStorage.setItem(
    'sample_pdf',
    JSON.stringify({ pdfName: 'sample_pdf', objects })
  )

  alert('Custom fields are saved for this document!')
}

function createCheckboxPlaceholder({ left, top, name }) {
  const box = new fabric.Rect({
    left, top,
    width: 18, height: 18,
    stroke: '#000',
    fill: '#fff',
    rx: 3, ry: 3,
  })

  const tick = new fabric.Path('M 3 10 L 8 15 L 15 4', {
    left, top,
    stroke: '#000',
    fill: null,
    strokeWidth: 2,
    visible: false,
    selectable: false,
    // slight offset to center visually
    transformMatrix: [1,0,0,1,2,2],
    name: 'checkmark',
  })

  const group = new fabric.Group([box, tick], {
    left, top,
    selectable: true,
    hasControls: true,
    hasBorders: true,

    // 🔒 enforce proportional (uniform) scaling
    lockUniScaling: true,
    lockScalingFlip: true,
  })

  // Hide side handles so users can’t “squash” it via edges
  group.setControlsVisibility({ ml:false, mr:false, mt:false, mb:false })

  // Belt & suspenders: force X/Y scale to match while dragging
  group.on('scaling', () => {
    const u = Math.max(group.scaleX, group.scaleY)
    group.scaleX = group.scaleY = u
  })

  // Custom metadata we’ll save/load later
  group.set({
    fieldType: 'checkbox',
    fieldName: name || 'checkbox',
    checked: false,
  })

  return group
}

// create free text

// ----- Editor: Free Text (500x500, white bg, black border) -----
function createFreeTextEditor({ left, top, name, placeholder = 'Type here…' }) {
  const PAD = 12
  const W = 500, H = 500
  const canvas = fabricCanvasInstance   // your editor canvas

  // children anchored at (0,0) inside the group to avoid drift
  const frame = new fabric.Rect({
    originX: 'left', originY: 'top',
    left: 0, top: 0,
    width: W, height: H,
    fill: '#fff',          // ✅ blocks PDF behind
    stroke: '#000',
    strokeWidth: 1,
    selectable: false, evented: false,
    objectCaching: false,
  })

  const hint = new fabric.Textbox(placeholder, {
    originX: 'left', originY: 'top',
    left: PAD, top: PAD,
    width: W - PAD * 2,
    fontSize: 16,
    fill: '#666',
    editable: false,
    selectable: false, evented: false,
    objectCaching: false,
  })

  const group = new fabric.Group([frame, hint], {
    originX: 'left', originY: 'top',
    left, top,
    hasControls: true, hasBorders: true,
    lockRotation: true,
    centeredScaling: false,     // scale from the handle, not center
    lockScalingFlip: true,
    objectCaching: false,
  })

  // Hide rotate handle
  group.setControlsVisibility({ mtr: false })

  // Flag to detect real scaling vs moving
  group._isScaling = false

  // ---------- Bound helpers ----------
  function clampMoveToCanvas() {
    const gw = group.getScaledWidth()
    const gh = group.getScaledHeight()
    const maxLeft = Math.max(0, canvas.getWidth()  - gw)
    const maxTop  = Math.max(0, canvas.getHeight() - gh)
    if (group.left < 0) group.left = 0
    if (group.top  < 0) group.top  = 0
    if (group.left > maxLeft) group.left = maxLeft
    if (group.top  > maxTop)  group.top  = maxTop
    group.setCoords()
  }

  function clampScaleToCanvas() {
    // current scaled size at this instant
    let gw = group.getScaledWidth()
    let gh = group.getScaledHeight()

    // max allowed so the box stays fully inside the canvas at current (left, top)
    const maxW = canvas.getWidth()  - group.left
    const maxH = canvas.getHeight() - group.top

    // shrink scale if it would overflow
    if (gw > maxW || gh > maxH) {
      const fx = maxW > 0 ? (maxW / gw) : 0.0001
      const fy = maxH > 0 ? (maxH / gh) : 0.0001
      const f = Math.min(fx, fy)
      group.scaleX *= f
      group.scaleY *= f
    }
    group.setCoords()
  }

  // ---------- Events ----------
  // Moving: clamp to bounds; DO NOT change size here
  group.on('moving', () => {
    clampMoveToCanvas()
    canvas.requestRenderAll()
  })

  // Scaling: mark flag; live clamp so the preview never leaves the canvas
  group.on('scaling', () => {
    group._isScaling = true
    clampScaleToCanvas()
    canvas.requestRenderAll()
  })

  // Modified fires after move or scale. Only bake width/height if we actually scaled.
  group.on('modified', () => {
    clampMoveToCanvas()
    if (group._isScaling) {
      const newW = Math.max(50, group.getScaledWidth())
      const newH = Math.max(50, group.getScaledHeight())
      frame.set({ width: newW, height: newH })
      hint.set({ left: PAD, top: PAD, width: Math.max(20, newW - PAD * 2) })
      group.set({ scaleX: 1, scaleY: 1 })   // bake the size, reset scale
      group._isScaling = false
    }
    group.addWithUpdate()
    canvas.requestRenderAll()
  })

  // Metadata
  group.set({
    fieldType: 'free-text',
    fieldName: name || 'freeText',
    _pad: PAD,
  })

  return group
}





  
  
// watch([() => props.base64, () => props.page, () => props.scale], renderPDF)
</script>


<style scoped>

.custom-fields{
  display: flex;
}
.pdf-viewer {
overflow: auto;
}

.canvas-wrapper {
  position: relative;
  display: inline-block;
}


.fabric-canvas {
  position: absolute;
  top: 0;
  left: 0;
}

.toolbox-item {
  padding: 6px 12px;
  background-color: #e0e0e0;
  margin: 6px;
  cursor: grab;
  border-radius: 4px;
  width: 200px;
  cursor: pointer;
  color: black
}

.pdf-canvas {
  pointer-events: none;
}

</style>
