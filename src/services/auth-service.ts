import { BigQuery } from '@google-cloud/bigquery';
import * as vscode from 'vscode';

/** Manages BigQuery client authentication and lifecycle */
export class AuthService {
  private client: BigQuery | null = null;
  private configListener: vscode.Disposable;

  constructor() {
    // Recreate client when settings change
    this.configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('bigqueryBrowser')) {
        this.client = null;
      }
    });
  }

  /** Get an authenticated BigQuery client instance */
  getClient(): BigQuery {
    if (this.client) {
      return this.client;
    }

    const config = vscode.workspace.getConfiguration('bigqueryBrowser');
    const projectId = config.get<string>('projectId') || undefined;
    const keyFilePath = config.get<string>('keyFilePath') || undefined;
    const location = config.get<string>('location', 'US');

    const options: ConstructorParameters<typeof BigQuery>[0] = {
      projectId,
      location,
    };

    // Use service account key if provided, otherwise fall back to ADC
    if (keyFilePath) {
      options.keyFilename = keyFilePath;
    }

    this.client = new BigQuery(options);
    return this.client;
  }

  /** Get configured project ID or prompt user to set one */
  async getProjectId(): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration('bigqueryBrowser');
    let projectId = config.get<string>('projectId');

    if (!projectId) {
      projectId = await vscode.window.showInputBox({
        prompt: 'Enter your Google Cloud Project ID',
        placeHolder: 'my-project-id',
      });
      if (projectId) {
        await config.update('projectId', projectId, vscode.ConfigurationTarget.Global);
      }
    }

    return projectId || undefined;
  }

  dispose(): void {
    this.configListener.dispose();
    this.client = null;
  }
}
