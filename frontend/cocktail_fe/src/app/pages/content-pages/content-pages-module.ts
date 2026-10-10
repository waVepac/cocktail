import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { ContentPagesRoutingModule } from "./content-pages-routing";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

@NgModule({
    imports: [
        CommonModule,
        ContentPagesRoutingModule,
        FormsModule,
        ReactiveFormsModule
    ],
    declarations: [

    ]
})
export class ContentPagesModule { }