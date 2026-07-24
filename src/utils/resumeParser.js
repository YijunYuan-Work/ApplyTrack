const supportedExtensions = new Set(['docx', 'pdf', 'txt'])
const maximumResumeBytes = 5 * 1024 * 1024
const commonSkills = [
  'AWS',
  'Azure',
  'C#',
  'C++',
  'CSS',
  'Docker',
  'Excel',
  'Git',
  'HTML',
  'Java',
  'JavaScript',
  'Node.js',
  'Power BI',
  'Python',
  'React',
  'SQL',
  'Supabase',
  'Tableau',
  'TypeScript',
]

function getExtension(fileName) {
  return fileName.split('.').pop()?.toLowerCase() || ''
}

export function detectResumeSkills(text) {
  const normalized = ` ${String(text || '').toLowerCase()} `

  return commonSkills.filter((skill) => {
    const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(normalized)
  })
}

async function extractPdfText(file) {
  const [{ GlobalWorkerOptions, getDocument }, workerModule] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = workerModule.default
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => item.str || '').join(' '))
  }

  return pages.join('\n\n')
}

async function extractDocxText(file) {
  const mammoth = await import('mammoth/mammoth.browser')
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return result.value
}

export async function extractResumeText(file) {
  const extension = getExtension(file.name)

  if (!supportedExtensions.has(extension)) {
    throw new Error('Choose a PDF, DOCX, or TXT resume.')
  }

  if (file.size > maximumResumeBytes) {
    throw new Error('Resume files must be 5 MB or smaller.')
  }

  let text

  if (extension === 'pdf') {
    text = await extractPdfText(file)
  } else if (extension === 'docx') {
    text = await extractDocxText(file)
  } else {
    text = await file.text()
  }

  const normalizedText = text
    .replaceAll(String.fromCharCode(0), '')
    .replace(/[ \t]+\n/g, '\n')
    .trim()

  if (!normalizedText) {
    throw new Error('No readable text was found in this resume.')
  }

  return {
    skills: detectResumeSkills(normalizedText),
    text: normalizedText,
  }
}
