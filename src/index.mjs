// @ts-check

import { createPrivateKey } from 'node:crypto';
import { execSync } from 'child_process';
import { info, setFailed, getInput } from '@actions/core';
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
 * @returns {Promise<number>} - The installation ID.
 */
async function findInstallationId(appId, privateKey, request) {
  const auth = createAppAuth({
    appId,
    privateKey,
    request,
  });

  const appAuthentication = await auth({ type: 'app' });
  const jwt = appAuthentication.token;
  if (!jwt) {
    setFailed('Failed to acquire JWT');
  }

  const octokit = getOctokit(jwt);
  const installations = await octokit.rest.apps.listInstallations();

  if (installations.data.length === 0) {
    setFailed('No installations found');
  }

  if (installations.data.length > 1) {
    setFailed(
      `Detected ${installations.data.length} installations. Please provide an 'installation-id' input.`,
    );
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

  const privateKeyPkcs8 = createPrivateKey(privateKeyInput).export({
    type: 'pkcs8',
    format: 'pem',
  });

  const installationId =
    getInput('installation-id') ||
    (await findInstallationId(appId, privateKeyPkcs8, customRequest));

  info(`Installation ID: ${installationId}`);

  const installationAuth = createAppAuth({
    appId,
    privateKey: privateKeyPkcs8,
    installationId,
    request: customRequest,
  });

  const installationAuthentication = await installationAuth({
    type: 'installation',
  });

  const token = installationAuthentication.token;
  if (!token) {
    setFailed('Failed to acquire installation token');
  }

  const command = `git config --global url."https://x-access-token:${token}@github.com/".insteadOf "https://github.com/"`;
  execSync(command);
};

run();
