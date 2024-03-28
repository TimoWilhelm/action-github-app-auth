import { createPrivateKey } from 'node:crypto';
import { execSync } from 'child_process';
import {
  info,
  setFailed,
  getInput,
  getBooleanInput,
  setOutput,
  setSecret,
  error,
} from '@actions/core';
import { getOctokit } from '@actions/github';
import { request } from '@octokit/request';

import { createAppAuth } from '@octokit/auth-app';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { RequestInterface } from '@octokit/types';

function getHttpsProxyAgent() {
  const proxy = process.env['HTTPS_PROXY'] || process.env['https_proxy'];

  if (!proxy) return undefined;

  return new HttpsProxyAgent(proxy);
}

async function findInstallationId(
  appId: string,
  privateKey: string,
  request: RequestInterface<object>,
) {
  const auth = createAppAuth({
    appId,
    privateKey,
    request,
  });

  const appAuthentication = await auth({ type: 'app' });

  const { token } = appAuthentication;
  const octokit = getOctokit(token);
  const installations = await octokit.rest.apps.listInstallations();

  if (installations.data.length === 0) {
    error('No installations found');
    return null;
  }

  if (installations.data.length > 1) {
    error(
      `Detected ${installations.data.length} installations. Please provide an 'installation-id' input.`,
    );
    return null;
  }

  const { id } = installations.data[0];
  return id;
}

async function run() {
  try {
    const appId = getInput('app-id');
    const privateKeyInput = getInput('private-key');

    const customRequest = request.defaults({
      request: {
        agent: getHttpsProxyAgent(),
      },
    });

    // Only PKCS#8 is supported - https://github.com/gr2m/universal-github-app-jwt#readme
    const privateKey = createPrivateKey(privateKeyInput)
      .export({
        type: 'pkcs8',
        format: 'pem',
      })
      .toString();

    const installationId =
      getInput('installation-id') || (await findInstallationId(appId, privateKey, customRequest));

    if (!installationId) {
      throw Error('Failed to acquire installation ID');
    }

    setOutput('installation-id', installationId);
    info(`Installation ID: ${installationId}`);

    const installationAuth = createAppAuth({
      appId,
      privateKey,
      installationId,
      request: customRequest,
    });

    const installationAuthentication = await installationAuth({
      type: 'installation',
    });

    const { token } = installationAuthentication;

    setSecret(token);
    setOutput('access-token', token);

    if (!getBooleanInput('set-git-credentials')) {
      info('Skipping git credential configuration');
      return;
    }
    const command = `git config --global url."https://x-access-token:${token}@github.com/".insteadOf "https://github.com/"`;
    execSync(command);

    info('Git credentials configured successfully');
  } catch (error) {
    if (error instanceof Error) {
      setFailed(error.message);
    } else {
      setFailed('An unexpected error occurred');
    }
  }
}

run();
