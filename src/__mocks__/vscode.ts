/**
 * Mock implementation of VS Code API for testing.
 * Provides mocked EventEmitter, Memento, workspace, window, and other VS Code APIs.
 */

export class EventEmitter<T = void> {
  private listeners: Array<(e: T) => void> = [];

  get event() {
    return (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
  }

  fire(data: T) {
    this.listeners.forEach(listener => listener(data));
  }

  dispose() {
    this.listeners = [];
  }
}

export const ProgressLocation = {
  Notification: 15,
  Window: 10,
  SourceControl: 1,
};

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

export class TreeItem {
  label?: string;
  collapsibleState?: number;
  contextValue?: string;
  description?: string;
  tooltip?: string;
  iconPath?: any;

  constructor(label: string, collapsibleState?: number) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class ThemeIcon {
  constructor(public id: string, public color?: ThemeColor) {}
}

export class ThemeColor {
  constructor(public id: string) {}
}

export class CancellationTokenSource {
  private _isCancelled = false;

  get token(): CancellationToken {
    return {
      isCancellationRequested: this._isCancelled,
      onCancellationRequested: new EventEmitter<void>().event,
    };
  }

  cancel() {
    this._isCancelled = true;
  }
}

export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  readonly onCancellationRequested: any;
}

export interface Selection {
  isEmpty: boolean;
}

export class TextEditor {
  document = {
    getText: (range?: any) => 'SELECT 1',
  };
  selection: Selection = { isEmpty: true };
}

export interface Memento {
  get<T>(key: string, defaultValue?: T): T | undefined;
  update(key: string, value: any): Promise<void>;
}

export class MemontoImpl implements Memento {
  private store = new Map<string, any>();

  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.store.get(key) ?? defaultValue;
  }

  async update(key: string, value: any): Promise<void> {
    if (value === undefined) {
      this.store.delete(key);
    } else {
      this.store.set(key, value);
    }
  }
}

export const workspace = {
  getConfiguration: (section?: string) => ({
    get: <T>(key: string, defaultValue?: T): T => {
      const configMap: Record<string, any> = {
        'bigqueryBrowser.maxResults': 50,
        'bigqueryBrowser.queryHistoryLimit': 100,
        'bigqueryBrowser.location': 'US',
        'bigqueryBrowser.maximumBytesBilledGb': 200,
        'bigqueryBrowser.costPerTbUsd': 6.25,
        'bigqueryBrowser.projectId': '',
        'bigqueryBrowser.executionProjectId': '',
        'bigqueryBrowser.keyFilePath': '',
        'bigqueryBrowser.autoDryRun': true,
      };
      const fullKey = section ? `${section}.${key}` : key;
      return configMap[fullKey] ?? defaultValue;
    },
  }),
};

export const window = {
  activeTextEditor: null as TextEditor | null,
  showErrorMessage: (message: string) => Promise.resolve(undefined),
  showWarningMessage: (message: string) => Promise.resolve(undefined),
  showInformationMessage: (message: string) => Promise.resolve(undefined),
  createTextEditorDecorationType: () => ({ dispose: () => {} }),
  withProgress: async <T>(
    options: any,
    task: (progress: any, token: CancellationToken) => Promise<T>,
  ): Promise<T> => {
    const progress = {
      report: (value: { message?: string; increment?: number }) => {},
    };
    const token: CancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: new EventEmitter<void>().event,
    };
    return task(progress, token);
  },
  createTreeView: (viewId: string, options: any) => ({
    dispose: () => {},
  }),
};

export const languages = {
  createDiagnosticCollection: (name: string) => ({
    set: (uri: any, diagnostics: any) => {},
    clear: () => {},
    delete: (uri: any) => {},
    dispose: () => {},
  }),
  registerHoverProvider: () => ({ dispose: () => {} }),
};

export const commands = {
  registerCommand: (command: string, callback: (...args: any[]) => any) => ({
    dispose: () => {},
  }),
};

export const Uri = {
  file: (path: string) => ({ fsPath: path }),
};

export interface ExtensionContext {
  globalState: Memento;
  globalStorageUri: { fsPath: string };
  extensionUri: any;
  subscriptions: any[];
}

export const Diagnostic = class {
  constructor(
    public range: any,
    public message: string,
    public severity?: number,
  ) {}
};

export const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
};

export const Range = class {
  constructor(
    public start: { line: number; character: number },
    public end: { line: number; character: number },
  ) {}
};

export const Position = class {
  constructor(public line: number, public character: number) {}
};
