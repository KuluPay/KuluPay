declare module "tsx" {
    export function tsImport(path: string, parentURL: string): Promise<any>;
}
