// *****************************************************************************
// Copyright (C) 2022 Ericsson and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import { OVSXClient, VSXExtensionRaw, VSXQueryOptions, VSXQueryResult, VSXSearchOptions, VSXSearchResult } from './ovsx-types';

/**
 * Querying will only find exact matches.
 * Searching will try to find the query string in various fields.
 */
export class OVSXMockClient implements OVSXClient {

    protected extensions: VSXExtensionRaw[];

    /**
     * @param extensions the format is `"namespace.name"` or `"namespace.name@version"`.
     * @param baseUrl base URL to use when defining the mock URLs.
     */
    constructor(
        extensions: string[],
        protected baseUrl: string = 'https://mock/'
    ) {
        const timestamp = new Date().toISOString();
        this.extensions = extensions.map(extension => {
            const [id, version = '0.0.1'] = extension.split('@', 2);
            const [namespace, name] = id.split('.', 2);
            return {
                allVersions: {
                    [version]: this.url(`/version/${id}@${version}`)
                },
                displayName: name,
                downloadCount: 0,
                files: {
                    download: this.url(`/download/${id}`)
                },
                name,
                namespace,
                namespaceAccess: 'public',
                namespaceUrl: this.url(`/namespace/${id}`),
                publishedBy: {
                    loginName: 'mock'
                },
                reviewCount: 0,
                reviewsUrl: this.url(`/reviews/${id}`),
                timestamp,
                version,
                description: `Mock VS Code Extension for ${id}`
            };
        });
    }

    async query(queryOptions?: VSXQueryOptions): Promise<VSXQueryResult> {
        return {
            extensions: this.extensions
                .filter(extension =>
                    this.compare(queryOptions?.extensionId, this.id(extension)) &&
                    this.compare(queryOptions?.extensionName, extension.name) &&
                    this.compare(queryOptions?.extensionVersion, extension.version) &&
                    this.compare(queryOptions?.namespaceName, extension.namespace))
        };
    }

    async search(searchOptions?: VSXSearchOptions): Promise<VSXSearchResult> {
        return {
            offset: 0,
            extensions: this.extensions
                .filter(extension =>
                    this.includes(searchOptions?.query, this.id(extension)) ||
                    this.includes(searchOptions?.query, extension.description) ||
                    this.includes(searchOptions?.query, extension.displayName))
                .filter((extension, i) => {
                    const offset = searchOptions?.offset ?? 0;
                    const size = searchOptions?.size ?? Infinity;
                    return i >= offset && i < size;
                })
                .map(extension => ({
                    downloadCount: extension.downloadCount,
                    files: extension.files,
                    name: extension.name,
                    namespace: extension.namespace,
                    timestamp: extension.timestamp,
                    url: this.url(`/version/${this.id(extension)}@${extension.version}`),
                    version: extension.version,
                }))
        };
    }

    protected id(extension: { name: string, namespace: string }): string {
        return `${extension.namespace}.${extension.name}`;
    }

    protected url(path: string): string {
        return new URL(path, this.baseUrl).toString();
    }

    /**
     * Case sensitive.
     *
     * @returns `true` if {@link expected} is `undefined`, `expected === value` otherwise.
     */
    protected compare(expected?: string, value?: string): boolean {
        return expected === undefined || expected === value;
    }

    /**
     * Case insensitive.
     *
     * @returns `true` if {@link needle} or {@link value} are `undefined`, otherwise if {@link value} includes {@link needle}.
     */
    protected includes(needle?: string, value?: string): boolean {
        return needle === undefined || value === undefined || value.toLowerCase().includes(needle.toLowerCase());
    }
}
