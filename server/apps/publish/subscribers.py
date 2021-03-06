# -*- coding: utf-8; -*-
#
# This file is part of Superdesk.
#
# Copyright 2013, 2014 Sourcefabric z.u. and contributors.
#
# For the full copyright and license information, please see the
# AUTHORS and LICENSE files distributed with this source code, or
# at https://www.sourcefabric.org/superdesk/license

import logging
from superdesk.resource import Resource
from superdesk.services import BaseService
from superdesk import get_resource_service
from superdesk.errors import SuperdeskApiError

logger = logging.getLogger(__name__)


class SubscribersResource(Resource):
    schema = {
        'name': {
            'type': 'string',
            'iunique': True,
            'required': True,
        },
        'subscriber_type': {
            'type': 'string'
        },
        'destinations': {
            'type': 'list',
            'schema': {
                'type': 'dict',
                'schema': {
                    'name': {'type': 'string'},
                    'delivery_type': {'type': 'string'},
                    'config': {'type': 'dict'}
                }
            }
        },
        'is_active': {
            'type': 'boolean',
            'default': True
        },
        'critical_errors': {
            'type': 'dict',
            'keyschema': {
                'type': 'boolean'
            }
        },
        'last_closed': {
            'type': 'dict',
            'schema': {
                'closed_at': {'type': 'datetime'},
                'closed_by': Resource.rel('users', nullable=True),
                'message': {'type': 'string'}
            }
        }
    }

    datasource = {'default_sort': [('_created', -1)]}
    privileges = {'POST': 'subscribers', 'DELETE': 'subscribers', 'PATCH': 'subscribers'}


class SubscribersService(BaseService):
    def on_delete(self, doc):
        lookup = {'destinations': str(doc.get('_id'))}
        subscribers = get_resource_service('output_channels').get(req=None, lookup=lookup)
        if subscribers and subscribers.count() > 0:
            raise SuperdeskApiError.preconditionFailedError(
                message='Subscriber is associated with Output Channel.')
