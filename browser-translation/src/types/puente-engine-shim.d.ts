declare module "@smart-tool/puente-engine" {
  export interface TranslationPipelineCreateOptions {
    configPath?: string;
    device?: string;
    dtype?: string;
    encoderFileName?: string;
    decoderFileName?: string;
    requestHeaders?: Record<string, string>;
    progress_callback?: (progress: {
      loaded?: number;
      total?: number;
    }) => void;
  }

  export interface TranslationPipelineResult {
    translation_text?: string;
  }

  export class TranslationPipeline {
    static create(
      modelPath: string,
      options?: TranslationPipelineCreateOptions
    ): Promise<TranslationPipeline>;

    translate(
      text: string,
      options?: Record<string, unknown>
    ): Promise<TranslationPipelineResult>;

    dispose(): Promise<void>;
  }
}
