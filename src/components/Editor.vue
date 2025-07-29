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
    const fieldType = e.dataTransfer.getData('text/plain')
    if (fieldType) {
      const text = new fabric.Textbox(fieldType, {
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

      text.setCoords();    
     
     fabricCanvasInstance.add(text)
               // ← update that text box’s corner coordinates
  //  fabricCanvasInstance.calcOffset(); // ← ensure canvas offset is fresh
     fabricCanvasInstance.setActiveObject(text)
     fabricCanvasInstance.renderAll()
     
     // Force a re-render after a short delay
    //  setTimeout(() => {
    //    fabricCanvasInstance.renderAll()
    //    console.log('Active object after timeout:', fabricCanvasInstance.getActiveObject())
    //  }, 100)
   }
 })
 
 // Add click event listener to canvas for debugging

 
 renderPDF()
})

const startDrag = (event,fieldName) => {
 event.dataTransfer.setData('text/plain',fieldName)
}

const saveFabricObject = () =>{
  const objects = fabricCanvasInstance.getObjects().map(o => ({
    placeholder: o.text,  // original fieldType is stored in .text
    left:        o.left,
    top:         o.top,
    width:       o.width * o.scaleX,
    height:      o.height * o.scaleY
  }))

  localStorage.setItem(
    'sample_pdf',
    JSON.stringify({ pdfName: 'sample_pdf', objects })
  )

  alert('Custom fields are saved for this document!')
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
