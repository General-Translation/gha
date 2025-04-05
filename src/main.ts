import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as path from 'path'
import * as fs from 'fs'

/**
 * Main function to run the translation action
 */
export async function run(): Promise<void> {
  try {
    // Get inputs
    const nodeVersion = core.getInput('node-version') || '20'

    // Log the Node.js version being used
    core.info(`Using Node.js version: ${nodeVersion}`)

    const workingDirectory = core.getInput('working-directory') || '.'
    const apiKey = core.getInput('api-key')
    const projectId = core.getInput('project-id')
    const commitMessage =
      core.getInput('commit-message') || 'Update translations via GT Action'
    const branchName = core.getInput('branch-name')
    const createPullRequest = core.getInput('create-pull-request') === 'true'
    const pullRequestTitle =
      core.getInput('pull-request-title') || 'Update translations'
    const pullRequestBody =
      core.getInput('pull-request-body') ||
      'This PR updates translations via the GT Action'

    // Validate required inputs
    if (!apiKey) {
      core.setFailed('GT_API_KEY is required')
      return
    }

    if (projectId) {
      core.info('GT_PROJECT_ID is set to ' + projectId)
    }

    // Validate working directory exists and contains gt.config.json
    const absoluteWorkingDir = path.resolve(workingDirectory)
    const configPath = path.join(absoluteWorkingDir, 'gt.config.json')

    if (!fs.existsSync(absoluteWorkingDir)) {
      core.setFailed(`Working directory does not exist: ${absoluteWorkingDir}`)
      return
    }

    if (!fs.existsSync(configPath)) {
      core.setFailed(`gt.config.json not found in ${absoluteWorkingDir}`)
      return
    }

    // Step 1: Install gtx-cli
    core.startGroup('Step 1: Installing gtx-cli')
    try {
      await exec.exec('npm', ['install', '-D', 'gtx-cli'])
      core.info('Successfully installed gtx-cli')
    } catch (error) {
      core.setFailed(
        `Failed to install gtx-cli: ${error instanceof Error ? error.message : String(error)}`
      )
      return
    }
    core.endGroup()

    // Step 2: Run translations
    core.startGroup('Step 2: Running translations')
    try {
      const env = {
        ...process.env,
        GT_API_KEY: apiKey,
        ...(projectId && { GT_PROJECT_ID: projectId })
      }

      await exec.exec('npx', ['gtx-cli', 'translate'], {
        cwd: absoluteWorkingDir,
        env: env
      })

      core.info('Successfully ran translations')
    } catch (error) {
      core.setFailed(
        `Failed to run translations: ${error instanceof Error ? error.message : String(error)}`
      )
      return
    }
    core.endGroup()

    // Step 3: Setup git config
    core.startGroup('Step 3: Setting up git configuration')
    try {
      await exec.exec('git', ['config', 'user.name', 'generaltranslation-bot'])
      await exec.exec('git', [
        'config',
        'user.email',
        'bot@generaltranslation.com'
      ])
      core.info('Git configuration complete')
    } catch (error) {
      core.setFailed(
        `Failed to configure git: ${error instanceof Error ? error.message : String(error)}`
      )
      return
    }
    core.endGroup()

    // Step 4: Check for changes
    core.startGroup('Step 4: Checking for changes')
    let hasChanges: boolean
    try {
      hasChanges = await checkForChanges()

      if (!hasChanges) {
        core.info('No translation changes detected. Skipping commit.')
        core.endGroup()
        return
      }

      core.info('Changes detected, proceeding with commit')
    } catch (error) {
      core.setFailed(
        `Failed to check for changes: ${error instanceof Error ? error.message : String(error)}`
      )
      core.endGroup()
      return
    }
    core.endGroup()

    // Step 5: Create new branch if specified
    if (branchName) {
      core.startGroup(`Step 5: Creating branch ${branchName}`)
      try {
        await exec.exec('git', ['checkout', '-b', branchName])
        core.info(`Created branch: ${branchName}`)
      } catch (error) {
        core.setFailed(
          `Failed to create branch: ${error instanceof Error ? error.message : String(error)}`
        )
        core.endGroup()
        return
      }
      core.endGroup()
    }

    // Step 6: Commit changes
    core.startGroup('Step 6: Committing changes')
    try {
      await exec.exec('git', ['add', '-A'])
      await exec.exec('git', ['commit', '-m', commitMessage])
      core.info('Changes committed successfully')
    } catch (error) {
      core.setFailed(
        `Failed to commit changes: ${error instanceof Error ? error.message : String(error)}`
      )
      core.endGroup()
      return
    }
    core.endGroup()

    // Step 7: Push changes
    core.startGroup('Step 7: Pushing changes')
    try {
      if (branchName) {
        await exec.exec('git', ['push', 'origin', branchName])
        core.info(`Pushed changes to ${branchName}`)
      } else {
        await exec.exec('git', ['push'])
        core.info('Pushed changes to current branch')
      }
    } catch (error) {
      core.setFailed(
        `Failed to push changes: ${error instanceof Error ? error.message : String(error)}`
      )
      core.endGroup()
      return
    }
    core.endGroup()

    // Step 8: Create PR if requested and branch name is provided
    if (createPullRequest && branchName) {
      core.startGroup('Step 8: Creating pull request')
      try {
        const token = process.env.GITHUB_TOKEN

        if (!token) {
          core.setFailed('GITHUB_TOKEN is required to create a pull request')
          core.endGroup()
          return
        }

        const octokit = github.getOctokit(token)
        const context = github.context

        // Default to main if can't determine current branch
        const baseBranch =
          process.env.GITHUB_REF?.replace('refs/heads/', '') || 'main'

        const response = await octokit.rest.pulls.create({
          owner: context.repo.owner,
          repo: context.repo.repo,
          title: pullRequestTitle,
          body: pullRequestBody,
          head: branchName,
          base: baseBranch
        })

        core.info(`Pull request created: ${response.data.html_url}`)
        core.setOutput('pull-request-url', response.data.html_url)
        core.setOutput('pull-request-number', response.data.number.toString())
      } catch (error) {
        core.setFailed(
          `Failed to create pull request: ${error instanceof Error ? error.message : String(error)}`
        )
        core.endGroup()
        return
      }
      core.endGroup()
    }

    core.info('GT Translation action completed successfully! 🎉')
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unknown error occurred')
    }
  }
}

/**
 * Check if there are any changes to commit
 */
async function checkForChanges(): Promise<boolean> {
  let output = ''
  const options: exec.ExecOptions = {
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      }
    }
  }

  await exec.exec('git', ['status', '--porcelain'], options)
  return output.trim().length > 0
}
