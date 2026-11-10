export type ApiResponse<T> = {
  data: T
  message?: string
  msg?: string
  code?: string | number
}
