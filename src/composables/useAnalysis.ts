import axios from 'axios'
import type { PackageMeta, AggregatedAnalysis } from '../types'

const api = axios.create({ baseURL: '/api' })

export async function uploadZip(file: File) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ packageId: string; meta: PackageMeta }>('/upload', form)
  return data
}

export async function getPackages() {
  const { data } = await api.get<PackageMeta[]>('/packages')
  return data
}

export async function getAnalysis(packageId: string) {
  const { data } = await api.get<AggregatedAnalysis>(`/analysis/${packageId}`)
  return data
}

export async function getReport(packageId: string) {
  const { data } = await api.get<{ report: string }>(`/ai/report/${packageId}`)
  return data.report
}

export async function regenerateReport(packageId: string) {
  const { data } = await api.post<{ report: string }>(`/ai/report/${packageId}`)
  return data.report
}

export async function diagnoseRule(packageId: string, ruleId: string) {
  const { data } = await api.post<{ report: string }>(`/ai/diagnose/${packageId}/${encodeURIComponent(ruleId)}`)
  return data.report
}
