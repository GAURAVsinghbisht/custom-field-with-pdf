<template>
<div class="pdf-viewer">
  <canvas ref="canvas"></canvas>
  <h1>Hello</h1>
</div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import * as pdfjsLib from 'pdfjs-dist/build/pdf'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// tell PDF.js where to find the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker

// base64 incoming via prop or however you like
const props = defineProps({
  base64: {
    type: String,
    required: true
  },
  scale: {
    type: Number,
    default: 1.5
  },
  page: {
    type: Number,
    default: 1
  }
})

const canvas = ref(null)

// whenever base64 or page changes, re-render
const renderPDF = async () => {
  if (!canvas.value || !props.base64) return

  // decode base64 to binary string
  const binary = atob(props.base64)

  // convert to Uint8Array
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const loadingTask = pdfjsLib.getDocument({ data: bytes })
  const pdf = await loadingTask.promise
  const pdfPage = await pdf.getPage(props.page)

  const viewport = pdfPage.getViewport({ scale: props.scale })
  const ctx = canvas.value.getContext('2d')
  canvas.value.width = viewport.width
  canvas.value.height = viewport.height

  await pdfPage.render({ canvasContext: ctx, viewport }).promise
}

onMounted(renderPDF)
watch([() => props.base64, () => props.page, () => props.scale], renderPDF)
</script>


<style scoped>
.pdf-viewer {
overflow: auto;
}
canvas {
display: block;
margin: auto;
}
</style>
