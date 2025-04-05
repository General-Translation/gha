# General Translation GitHub Action

This GitHub Action automates translations for your project using General
Translation's CLI tool (`gtx-cli`). It can commit the changes directly to your
repository or create a pull request with the updates.

## Features

- 🔄 Automatically translates your project using General Translation's API
- 🤖 Commits changes back to your repository
- 🔀 Optionally creates a pull request with the translation changes
- ⚙️ Fully configurable with inputs for all common use cases

## Prerequisites

- A General Translation account with an API key and project ID
- A project with a valid `gt.config.json` file in the repository (Run
  `npx gtx-cli init` to create one)

## Usage

Create a GitHub Action workflow file in your repository (e.g.,
`.github/workflows/translate.yml`):

```yaml
name: Translate Project

on:
  push:
    branches:
      - main
  workflow_dispatch: # Allow manual triggering

jobs:
  translate:
    runs-on: ubuntu-latest

    # Required permissions
    permissions:
      contents: write # For git operations
      pull-requests: write # For creating PRs

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run GT Translate
        uses: general-translation/gt-translate-action@v1
        with:
          api-key: ${{ secrets.GT_API_KEY }}
          # Optional parameters
          project-id: ${{ secrets.GT_PROJECT_ID }} # Only needed if not provided in the gt.config.json file
          branch-name: 'translation-updates'
          create-pull-request: 'true'
          pull-request-title: 'Update translations'
          pull-request-body: 'This PR updates translations via the GT Action'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Check the [examples directory](./examples) for more detailed workflow
configurations.

## Inputs

| Name                  | Description                               | Required | Default                                            |
| --------------------- | ----------------------------------------- | -------- | -------------------------------------------------- |
| `node-version`        | Node.js version to use                    | No       | `'20'`                                             |
| `working-directory`   | Directory where gt.config.json is located | No       | `'.'`                                              |
| `api-key`             | General Translation API key               | Yes      | N/A                                                |
| `project-id`          | General Translation project ID            | No       | N/A                                                |
| `commit-message`      | Commit message for translation updates    | No       | `'Update translations via GT Action'`              |
| `branch-name`         | Branch name for translation changes       | No       | `''` (current branch)                              |
| `create-pull-request` | Whether to create a pull request          | No       | `'false'`                                          |
| `pull-request-title`  | Title for the pull request                | No       | `'Update translations'`                            |
| `pull-request-body`   | Body for the pull request                 | No       | `'This PR updates translations via the GT Action'` |

## Outputs

| Name                  | Description                        |
| --------------------- | ---------------------------------- |
| `pull-request-url`    | URL of the created pull request    |
| `pull-request-number` | Number of the created pull request |

You can use these outputs in subsequent steps of your workflow:

```yaml
- name: Run GT
  id: translate
  uses: general-translation/gt-translate-action@v1
  with:
    api-key: ${{ secrets.GT_API_KEY }}
    project-id: ${{ secrets.GT_PROJECT_ID }}
    branch-name: 'translation-updates'
    create-pull-request: 'true'

- name: Comment on PR
  if: steps.translate.outputs.pull-request-url != ''
  uses: actions/github-script@v6
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    script: |
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: ${{ steps.translate.outputs.pull-request-number }},
        body: 'Translation PR created by the GT Action!'
      })
```

## Required Permissions

For this action to work properly, make sure your workflow has the following
permissions:

```yaml
permissions:
  contents: write # For git operations like creating branches and committing changes
  pull-requests: write # If using the create-pull-request option
```

## How It Works

1. Checks out your repository
2. Installs and runs `gtx-cli translate` with your API key and project ID
3. Commits any changes to your repository
4. Optionally creates a new branch and pull request with the changes

## Security Considerations

- Use GitHub Secrets to store sensitive information like your API key and
  project ID
- Consider using a dedicated service account/API key for CI operations

## Troubleshooting

- Make sure your `gt.config.json` file is properly configured
- Verify that your API key and project ID are correct
- Check GitHub Action logs for detailed error messages

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
