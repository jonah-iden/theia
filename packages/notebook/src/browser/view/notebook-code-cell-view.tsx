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

import { inject, injectable } from '@theia/core/shared/inversify';
import * as React from '@theia/core/shared/react';
import { MonacoEditorServices } from '@theia/monaco/lib/browser/monaco-editor';
import { CellOutputWebviewFactory, cellOutputWebviewFactory, CellOutputWebview } from '../renderers/cell-output-webview';
import { NotebookRendererRegistry } from '../notebook-renderer-registry';
import { NotebookCellModel } from '../view-model/notebook-cell-model';
import { NotebookModel } from '../view-model/notebook-model';
import { CellEditor } from './notebook-cell-editor';
import { CellRenderer } from './notebook-cell-list-view';

@injectable()
export class NotebookCodeCellRenderer implements CellRenderer {
    @inject(MonacoEditorServices)
    protected readonly monacoServices: MonacoEditorServices;

    @inject(NotebookRendererRegistry)
    protected readonly notebookRendererRegistry: NotebookRendererRegistry;

    @inject(cellOutputWebviewFactory)
    protected readonly cellOutputWebviewFactory: CellOutputWebviewFactory;

    render(notebookModel: NotebookModel, cell: NotebookCellModel, handle: number): React.ReactNode {
        return <div>
            <CellEditor notebookModel={notebookModel} cell={cell} monacoServices={this.monacoServices} />
            <NotebookCodeCellOutputs cell={cell} outputWebviewFactory={this.cellOutputWebviewFactory} />
        </div >;
    }
}

export interface NotebookCellOutputProps {
    cell: NotebookCellModel;
    outputWebviewFactory: CellOutputWebviewFactory;
}

export class NotebookCodeCellOutputs extends React.Component<NotebookCellOutputProps> {

    protected outputsWebview: CellOutputWebview | undefined;

    constructor(props: NotebookCellOutputProps) {
        super(props);
    }

    override async componentDidMount(): Promise<void> {
        const {cell, outputWebviewFactory} = this.props;
        cell.onDidChangeOutputs(async () => {
            if (!this.outputsWebview && cell.outputs.length > 0) {
                this.outputsWebview = await outputWebviewFactory(cell);
            } else if (this.outputsWebview && cell.outputs.length === 0) {
                this.outputsWebview.dispose();
                this.outputsWebview = undefined;
            }
            this.forceUpdate();
        });
        if (cell.outputs.length > 0) {
            this.outputsWebview = await outputWebviewFactory(cell);
            this.forceUpdate();
        }
    }

    override componentDidUpdate(): void {
        if (!this.outputsWebview?.isAttached()) {
            this.outputsWebview?.attachWebview();
        }
    }

    override render(): React.ReactNode {
        return <>{this.outputsWebview && this.outputsWebview.render()}</>;

    }

}