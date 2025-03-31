import type { CollectionConfig } from 'payload'

export const Workflows: CollectionConfig = {
  slug: 'workflows',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'application', 'updatedAt'],
    description: 'Stores sequences of actions for automation.'
  },
  access: {
    read: () => true, 
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'name',
      label: 'Workflow Name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      label: 'Workflow Description',
      type: 'textarea',
      required: false,
    },
    {
      name: 'application',
      label: 'Target Application',
      type: 'relationship',
      relationTo: 'applications',
      hasMany: false,
      required: true,
      admin: {
        position: 'sidebar', 
      },
    },
    {
      name: 'steps',
      label: 'Workflow Steps',
      type: 'array',
      minRows: 1,
      fields: [
        {
          name: 'action',
          label: 'Action Type',
          type: 'select',
          options: [
            { label: 'Screenshot', value: 'screenshot' },
            { label: 'Left Click', value: 'left_click' },
            { label: 'Right Click', value: 'right_click' },
            { label: 'Middle Click', value: 'middle_click' },
            { label: 'Double Click', value: 'double_click' },
            { label: 'Left Click Drag', value: 'left_click_drag' },
            { label: 'Mouse Move', value: 'mouse_move' },
            { label: 'Type Text', value: 'type' },
            { label: 'Press Key', value: 'key' },
            { label: 'Get Cursor Position', value: 'cursor_position' },
          ],
          required: true,
        },
        {
          name: 'description',
          label: 'Step Description (Goal)',
          type: 'text',
          required: false,
        },
        {
          name: 'coordinates',
          label: 'Coordinates [x, y]',
          type: 'json',
          required: false,
          admin: {
              description: 'Required for click, move, drag actions. E.g., [100, 250]',
              condition: (_, siblingData) => 
                 ['left_click', 'right_click', 'middle_click', 'double_click', 'left_click_drag', 'mouse_move'].includes(siblingData.action)
          }
        },
        {
          name: 'text',
          label: 'Text Input',
          type: 'text',
          required: false,
          admin: {
            description: 'Required for type and key actions.',
            condition: (_, siblingData) => ['type', 'key'].includes(siblingData.action)
          }
        },
      ],
    },
  ],
}
