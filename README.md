# GitHub App Authentication

This action allows you to authenticate as an installation of a GitHub App in your workflow. This can
be a more secure way to authenticate than using a personal access token that is tied to a user
account.

One use case for this would be cloning a private repository in a GitHub organization outside of the
repository where the workflow is running.

## Inputs

- `app-id` (Required) - The ID of the GitHub App that you want to authenticate as. This can be found
  in the settings of the GitHub App.
- `private-key` (Required) - The private key of the GitHub App that you want to authenticate as.
  This can be generated in the settings of the GitHub App.
  [Learn more about private keys](https://docs.github.com/apps/building-github-apps/authentication-options-for-github-apps/#generating-a-private-key).
  It should start with `-----BEGIN RSA PRIVATE KEY-----` and end with
  `-----END RSA PRIVATE KEY-----`.
- `installation-id` (Optional) - The ID of the installation of the GitHub App that you want to
  authenticate as. Only required if multiple installations of the GitHub App exist.
- `set-git-credentials` (Optional) - If set to `true`, the action will configure the git credentials
  for GitHub URLs. This allows you to clone private repositories if the installation has access to
  them.

## Outputs

- `access-token` - The access token that was generated for the installation marked as a secret. I
  can be used in subsequent steps to authenticate as the GitHub App installation but will not be
  printed to the logs. The token expires after 10 minutes.

## Configuration

If you want to use this action to clone a private repository, you need to grant the installation read access to the repository. You can manage the access in the settings of the installation in your organization or profile settings.

![Repository Access Settings](/docs/repo_access.png)

## Usage

```yaml
name: GitHub Actions Demo
run-name: ${{ github.actor }} is testing out GitHub Actions 🚀
on:
  workflow_dispatch:
  push:
    branches:
      - main
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: timowilhelm/github-app-authentication@v1
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          set-git-credentials: true
      - run: |
          git clone https://github.com/<ORG_NAME>/<PRIVATE_REPO_NAME>
```

## Acknowledgements

Inspired by https://github.com/daspn/private-actions-checkout
