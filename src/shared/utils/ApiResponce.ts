class ApiResponse<T = unknown> {
  statusCode: number;
  message: string;
  data: T;
  status: boolean;

  constructor(
    statusCode: number,
    data: T,
    message: string = "Success"
  ) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.status = statusCode < 400;
  }
}

export { ApiResponse };
