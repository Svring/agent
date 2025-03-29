// Types for the Operator service responses
export interface ProbeResponse {
  message: string;
}

export interface ClickResponse {
  success: boolean;
  message: string;
}

export interface MoveResponse {
  success: boolean;
  message: string;
}

export interface ScreenSizeResponse {
  width: number;
  height: number;
}

export interface ScreenshotBase64Response {
  success: boolean;
  format: string;
  base64_image: string;
  is_full_screen: boolean;
} 