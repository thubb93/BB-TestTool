import axios from 'axios'
import * as fs from 'fs-extra'
import * as path from 'path'

const TMP_DIR = process.env.TMP_DIR || '/tmp/bb-testool-bot'

export interface SlackFile {
  id: string
  name: string
  mimetype: string
  url_private: string
}

/**
 * Download một file từ Slack về local /tmp
 * Trả về đường dẫn local của file đã download
 */
export async function downloadSlackFile(
  file: SlackFile,
  botToken: string
): Promise<string> {
  await fs.ensureDir(TMP_DIR)

  const localPath = path.join(TMP_DIR, `${Date.now()}-${file.name}`)

  const response = await axios.get(file.url_private, {
    headers: { Authorization: `Bearer ${botToken}` },
    responseType: 'arraybuffer',
  })

  await fs.writeFile(localPath, response.data)
  console.log(`[file] Downloaded: ${file.name} → ${localPath}`)
  return localPath
}

/**
 * Đọc nội dung file text (spec.md, design doc, v.v.)
 */
export async function readFileContent(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

/**
 * Xóa file tạm sau khi xử lý xong
 */
export async function cleanupFile(filePath: string): Promise<void> {
  await fs.remove(filePath).catch(() => {}) // silent fail
}
