// @ts-check

import { createPrivateKey } from 'node:crypto';
import { execSync } from 'child_process';
import { info, setFailed, getInput, setOutput, setSecret } from '@actions/core';
import { getOctokit } from '@actions/github';
import { request } from '@octokit/request';

import { createAppAuth } from '@octokit/auth-app';
import { HttpsProxyAgent } from 'https-proxy-agent';

function getHttpsProxyAgent() {
  const proxy = process.env['HTTPS_PROXY'] || process.env['https_proxy'];

  if (!proxy) return undefined;

  return new HttpsProxyAgent(proxy);
}

/**
 * Retrieves the installation ID for a GitHub App if it only has one installation.
 * @param {string} appId - ID of the GitHub App.
 * @param {string} privateKey - Private key of the GitHub App.
 * @param {import('@octokit/types').RequestInterface<object> | undefined} request - A custom request object used for API calls.
 * @returns {Promise<number> | undefined} - The installation ID.
 */
async function findInstallationId(appId, privateKey, request) {
  const auth = createAppAuth({
    appId,
    privateKey,
    request,
  });

  const appAuthentication = await auth({ type: 'app' });
  const jwt = appAuthentication.token;

  const octokit = getOctokit(appAuthentication.token);
  const installations = await octokit.rest.apps.listInstallations();

  if (installations.data.length === 0) {
    setFailed('No installations found');
    return;
  }

  if (installations.data.length > 1) {
    setFailed(
      `Detected ${installations.data.length} installations. Please provide an 'installation-id' input.`,
    );
    return;
  }

  const { id } = installations.data[0];
  return id;
}

const run = async () => {
  const appId = getInput('app-id');
  const privateKeyInput = getInput('private-key');

  const customRequest = request.defaults({
    request: {
      agent: getHttpsProxyAgent(),
    },
  });

  // Only PKCS#8 is supported - https://github.com/gr2m/universal-github-app-jwt#readme
  const privateKey = createPrivateKey(privateKeyInput).export({
    type: 'pkcs8',
    format: 'pem',
  });

  const installationId =
    getInput('installation-id') || (await findInstallationId(appId, privateKey, customRequest));

  if (!installationId) {
    setFailed('Failed to acquire installation ID');
    return;
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

  const token = installationAuthentication.token;

  if (!token) {
    setFailed('Failed to acquire installation token');
    return;
  }

  setSecret(token);
  setOutput('access-token', token);

  if (getInput('set-git-credentials') !== 'true') {
    info('Skipping git credential configuration');
    return;
  }
  const command = `git config --global url."https://x-access-token:${token}@github.com/".insteadOf "https://github.com/"`;
  execSync(command);

  info('Git credentials configured successfully');
};

run();
