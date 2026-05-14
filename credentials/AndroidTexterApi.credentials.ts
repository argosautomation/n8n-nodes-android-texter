import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * Auth credential for the Android Texter API.
 *
 * Users generate a long-lived key on https://androidtexter.com/dashboard/settings/api-keys
 * (prefix `atx_` or `at_`) and paste it here. The server accepts the key on
 * any of the `flexible` and `/api/v1` routes via the `X-API-Key` header — the
 * same scheme our docs and Postman collection use.
 *
 * The credential-test request hits `GET /api/me`, which is the cheapest
 * authenticated round-trip — returns the user's profile, subscription tier,
 * and today's usage. Anything other than 200 fails the test cleanly.
 */
export class AndroidTexterApi implements ICredentialType {
	name = 'androidTexterApi';
	displayName = 'Android Texter API';
	documentationUrl = 'https://androidtexter.com/dashboard/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Generate at https://androidtexter.com/dashboard/settings/api-keys. Starts with `atx_` or `at_`.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://androidtexter.com',
			description:
				'Leave as the default unless you are running a self-hosted Android Texter instance.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/me',
			method: 'GET',
		},
	};
}
