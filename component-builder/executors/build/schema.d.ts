export interface ComponentBuilderExecutorOptions {
    sourceFiles?: string[];
    themeFiles?: string[];
    outputPath: string;
    postcssConfig?: string;
    watch?: boolean;
    clean?: boolean;
}
