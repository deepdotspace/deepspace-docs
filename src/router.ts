// Generouted, changes to this file will be overridden
/* eslint-disable */

import { components, hooks, utils } from '@generouted/react-router/client'

export type Path =
  | `*`
  | `/`
  | `/browse/:userId`
  | `/browse/:userId/doc/:docId`
  | `/doc/:docId`

export type Params = {
  '/*': { '*': string }
  '/browse/:userId': { userId: string }
  '/browse/:userId/doc/:docId': { userId: string; docId: string }
  '/doc/:docId': { docId: string }
}

export type ModalPath = never

export const { Link, Navigate } = components<Path, Params>()
export const { useModals, useNavigate, useParams } = hooks<Path, Params, ModalPath>()
export const { redirect } = utils<Path, Params>()
