// *****************************************************************************
// Copyright (C) 2023 TypeFox and others.
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
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, Event, URI } from '@theia/core';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Emitter } from '@theia/core/shared/vscode-languageserver-protocol';
import { NotebookModel } from '../view-model/notebook-model';
import { NotebookService } from './notebook-service';

export interface SelectedNotebooksChangeEvent {
    notebook: URI;
    oldKernel: string | undefined;
    newKernel: string | undefined;
}

export interface NotebookKernelMatchResult {
    readonly selected: NotebookKernel | undefined;
    readonly suggestions: NotebookKernel[];
    readonly all: NotebookKernel[];
    readonly hidden: NotebookKernel[];
}

export interface NotebookKernelChangeEvent {
    label?: true;
    description?: true;
    detail?: true;
    supportedLanguages?: true;
    hasExecutionOrder?: true;
    hasInterruptHandler?: true;
}

export interface NotebookKernel {
    readonly id: string;
    readonly viewType: string;
    readonly onDidChange: Event<Readonly<NotebookKernelChangeEvent>>;
    readonly extension: string;

    readonly localResourceRoot: URI;
    readonly preloadUris: URI[];
    readonly preloadProvides: string[];

    label: string;
    description?: string;
    detail?: string;
    supportedLanguages: string[];
    implementsInterrupt?: boolean;
    implementsExecutionOrder?: boolean;

    executeNotebookCellsRequest(uri: URI, cellHandles: number[]): Promise<void>;
    cancelNotebookCellExecution(uri: URI, cellHandles: number[]): Promise<void>;
}

export const enum ProxyKernelState {
    Disconnected = 1,
    Connected = 2,
    Initializing = 3
}

export interface INotebookProxyKernelChangeEvent extends NotebookKernelChangeEvent {
    connectionState?: true;
}

export interface NotebookTextModelLike { uri: URI; viewType: string }

class KernelInfo {

    private static logicClock = 0;

    readonly kernel: NotebookKernel;
    public score: number;
    readonly time: number;

    constructor(kernel: NotebookKernel) {
        this.kernel = kernel;
        this.score = -1;
        this.time = KernelInfo.logicClock++;
    }
}

@injectable()
export class NotebookKernelService {

    @inject(NotebookService)
    protected notebookService: NotebookService;

    private readonly kernels = new Map<string, KernelInfo>();

    private readonly notebookBindings = new Map<string, string>();

    private readonly onDidAddKernelEmitter = new Emitter<NotebookKernel>();
    readonly onDidAddKernel: Event<NotebookKernel> = this.onDidAddKernelEmitter.event;

    private readonly onDidRemoveKernelEmitter = new Emitter<NotebookKernel>();
    readonly onDidRemoveKernel: Event<NotebookKernel> = this.onDidRemoveKernelEmitter.event;

    private readonly onDidChangeSelectedNotebooksEmitter = new Emitter<SelectedNotebooksChangeEvent>();
    readonly onDidChangeSelectedNotebooks: Event<SelectedNotebooksChangeEvent> = this.onDidChangeSelectedNotebooksEmitter.event;

    private readonly onDidChangeNotebookAffinityEmitter = new Emitter<void>();
    readonly onDidChangeNotebookAffinity: Event<void> = this.onDidChangeNotebookAffinityEmitter.event;

    registerKernel(kernel: NotebookKernel): Disposable {
        if (this.kernels.has(kernel.id)) {
            throw new Error(`NOTEBOOK CONTROLLER with id '${kernel.id}' already exists`);
        }

        this.kernels.set(kernel.id, new KernelInfo(kernel));
        this.onDidAddKernelEmitter.fire(kernel);

        return Disposable.create(() => {
            if (this.kernels.delete(kernel.id)) {
                this.onDidRemoveKernelEmitter.fire(kernel);
            }
        });
    }

    getMatchingKernel(notebook: NotebookTextModelLike): NotebookKernelMatchResult {
        const kernels: { kernel: NotebookKernel; instanceAffinity: number; score: number }[] = [];
        for (const info of this.kernels.values()) {
            const score = NotebookKernelService.score(info.kernel, notebook);
            if (score) {
                kernels.push({
                    score,
                    kernel: info.kernel,
                    instanceAffinity: 1 /* vscode.NotebookControllerPriority.Default */,
                });
            }
        }

        kernels
            .sort((a, b) => b.instanceAffinity - a.instanceAffinity || a.score - b.score || a.kernel.label.localeCompare(b.kernel.label));
        const all = kernels.map(obj => obj.kernel);

        // bound kernel
        const selectedId = this.notebookBindings.get(`${notebook.viewType}/${notebook.uri}`);
        const selected = selectedId ? this.kernels.get(selectedId)?.kernel : undefined;
        const suggestions = kernels.filter(item => item.instanceAffinity > 1).map(item => item.kernel);
        const hidden = kernels.filter(item => item.instanceAffinity < 0).map(item => item.kernel);
        return { all, selected, suggestions, hidden };

    }

    selectKernelForNotebook(kernel: NotebookKernel | undefined, notebook: NotebookTextModelLike): void {
        const key = `${notebook.viewType}/${notebook.uri}`;
        const oldKernel = this.notebookBindings.get(key);
        if (oldKernel !== kernel?.id) {
            if (kernel) {
                this.notebookBindings.set(key, kernel.id);
            } else {
                this.notebookBindings.delete(key);
            }
        }
    }

    getSelectedOrSuggestedKernel(notebook: NotebookModel): NotebookKernel | undefined {
        const info = this.getMatchingKernel(notebook);
        if (info.selected) {
            return info.selected;
        }

        return info.all.length === 1 ? info.all[0] : undefined;
    }

    private static score(kernel: NotebookKernel, notebook: NotebookTextModelLike): number {
        if (kernel.viewType === '*') {
            return 5;
        } else if (kernel.viewType === notebook.viewType) {
            return 10;
        } else {
            return 0;
        }
    }

}
