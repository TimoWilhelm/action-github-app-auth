import { createPrivateKey } from "node:crypto";
import { getOctokit } from "@actions/github";
import { info, setFailed, getInput } from "@actions/core";
import { request } from "@octokit/request";
import { execSync } from "child_process";
import { createAppAuth } from "@octokit/auth-app";
import { HttpsProxyAgent } from 'https-proxy-agent';

function getHttpsProxyAgent() {
  const proxy = process.env["HTTPS_PROXY"] || process.env["https_proxy"];

  if (!proxy) return undefined;

  return new HttpsProxyAgent(proxy);
}

const run = async () => {
  const appId = getInput("app-id");
  const privateKey = getInput("private-key")

  const customRequest = request.defaults({
    request: {
      agent: getHttpsProxyAgent()
    }
  });

  const privateKeyPkcs8 = createPrivateKey(privateKey).export({
    type: "pkcs8",
    format: "pem",
  });

  // Obtain JWT
  const auth = createAppAuth({
    appId,
    privateKey: privateKeyPkcs8,
    request: customRequest,
  });

  const appAuthentication = await auth({ type: "app" });
  const jwt = appAuthentication.token;
  if (!jwt) {
    setFailed("Cannot get app JWT");
  }

  // Obtain installation id
  const octokit = getOctokit(jwt);
  const installations = await octokit.rest.apps.listInstallations();
  if (installations.data.length !== 1) {
    setFailed(
      `Only 1 installation is allowed for this app. We detected it has ${installations.data.length} installations`
    );
  }
  const { id: installationId } = installations.data[0];
  info(`Installation: ${installationId}`);

  // Obtain token
  const installationAuth = createAppAuth({
    appId,
    privateKey: privateKeyPkcs8,
    installationId,
    request: customRequest,
  });
  const installationAuthentication = await installationAuth({
    type: "installation",
  });
  const token = installationAuthentication.token;
  if (!token) {
    setFailed("Cannot get app token");
  }

  const command = `git config --global url."https://x-access-token:${token}@github.com/".insteadOf "https://github.com/"`;
  execSync(command);
};

run();
