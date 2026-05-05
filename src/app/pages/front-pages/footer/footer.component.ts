import { MediaMatcher } from '@angular/cdk/layout';

import { Component, DestroyRef, inject } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { RouterLink, RouterModule } from '@angular/router';
import { BrandingComponent } from 'src/app/layouts/full/vertical/sidebar/branding.component';
@Component({
  selector: 'app-footer',
  imports: [
    MaterialModule,
    TablerIconsModule,
    RouterLink,
    RouterModule,
    BrandingComponent
],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  constructor() { }

  applicationsItems = [
    {
      title: 'Kanban',
      href: "/apps/kanban"
    },
    {
      title: 'Invoice List',
      href: "/apps/invoice/list"
    },
    {
      title: 'eCommerce',
      href: "/apps/product/shop"
    },
    {
      title: 'Chats',
      href: "/apps/chat"
    },
    {
      title: 'Tickets',
      href: "/apps/tickets"
    },
    {
      title: 'Blog',
      href: "/apps/blog/post"
    },
  ];

  formsItems = [
    {
      title: 'Form Layout',
      href: "/forms/form-layouts"
    },
    {
      title: 'Form Horizontal',
      href: "/forms/form-horizontal"
    },
    {
      title: 'Form Wizard',
      href: "/forms/form-wizard"
    },
    {
      title: 'Form Vertical',
      href: "/forms/form-vertical"
    },
    {
      title: 'Form Toastr',
      href: "/forms/form-toastr"
    },
  ];

  tablesItems = [
    {
      title: 'Basic Table',
      href: "/tables/basic-table"
    },
    {
      title: 'Multi Header Footer Table',
      href: "/tables/multi-header-footer-table"
    },
    {
      title: 'Pagination Table',
      href: "/tables/pagination-table"
    },
    {
      title: 'Dynamic Table',
      href: "/tables/dynamic-table"
    },
    {
      title: 'HTTP Table',
      href: "/tables/http-table"
    },
    {
      title: 'Sortable Table',
      href: "/tables/sortable-table"
    },
  ];

  socialIcons = [
    { src: 'assets/images/front-end/icon-facebook.svg', tooltip: 'Facebook' },
    { src: 'assets/images/front-end/icon-twitter.svg', tooltip: 'Twitter' },
    { src: 'assets/images/front-end/icon-instagram.svg', tooltip: 'Instagram' },
  ];

  getRouterLink(path: string): string {
    return path.startsWith('/') ? path : '/' + path;
  }
}
