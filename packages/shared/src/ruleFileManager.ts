// @ts-expect-error
import { readJson } from 'fs-extra/esm'
import { v4 as uuidV4 } from 'uuid'
import _ from 'lodash-es'
import type { Low } from 'lowdb/lib'
import { JSONFilePreset } from 'lowdb/node'
import axios from 'axios'
import type { Rule } from '@any-reader/core'
import { BOOK_SOURCE_PATH } from './constants'

let mDb: Low<Rule[]>

async function getDb() {
  if (mDb)
    return mDb
  const data = await readJson(BOOK_SOURCE_PATH).catch(() => ([]))
  mDb = await JSONFilePreset<Rule[]>(BOOK_SOURCE_PATH, data)
  return mDb
}

const writeDB = _.throttle(async () => {
  const db = await getDb()
  db.write()
}, 1000)

// 初始化
export async function init() {}

export async function list(): Promise<Rule[]> {
  const db = await getDb()
  return db.data
}

// 删除记录
export async function del(id: string | string[], saveFile = true) {
  const db = await getDb()
  const ids = Array.isArray(id) ? id : [id]
  db.data = db.data.filter(e => !ids.includes(e.id))
  if (saveFile)
    await writeDB()
}

// 更新记录
export async function update(rule: Rule) {
  if (!rule.id)
    rule.id = uuidV4()
  const db = await getDb()
  const row = db.data.find(e => e.id === rule.id)
  if (!row)
    db.data.push(rule)
  else
    Object.assign(row, rule)

  writeDB()
}

// 批量更新
export async function batchUpdate({ ids, rule }: { ids: string[];rule: Rule }) {
  const db = await getDb()
  for (let i = 0; i < db.data.length; i++) {
    const row = db.data[i]
    if (ids.includes(row.id))
      Object.assign(row, rule)
  }
  writeDB()
}

export async function findById(id: string): Promise<Rule> {
  const db = await getDb()
  return db.data.find(e => e.id === id) as Rule
}

// 更新排序
export async function updateRuleSort(ids: string[]) {
  if (!Array.isArray(ids))
    return
  const db = await getDb()
  let sort = 1
  for (let i = ids.length - 1; i >= 0; i--) {
    const row = db.data.find(e => e.id === ids[i])
    if (row)
      row.sort = sort
    sort++
  }
  writeDB()
}

/**
 *
 * @param rule
 * @returns {boolean}
 */
export function isRule(rule: any): boolean {
  if (typeof rule === 'string')
    return rule.startsWith('eso://:')

  if (typeof rule !== 'object')
    return false

  return rule.id && rule.host && rule.contentType
}

export async function importRules(url: string) {
  const res = await axios.create().get(url).catch((e) => {
    console.warn(e)
  })
  if (!res || Array.isArray(res?.data))
    return

  for (const rule of res.data) {
    if (isRule(rule))
      await update(rule).catch(() => {})
  }

  return res.data.length
}
