# Authentication

BigQuery Browser uses Google Cloud credentials to connect to your project.

## Option 1: Application Default Credentials (Recommended)

Run in your terminal:

```bash
gcloud auth application-default login
```

## Option 2: Service Account Key

1. Create a service account key in GCP Console
2. Download the JSON key file
3. Set the path in VS Code settings: `bigqueryBrowser.keyFilePath`

## Option 3: gcloud CLI

If ADC is not set, the extension falls back to `gcloud auth` credentials.
