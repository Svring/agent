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
      name: 'sequenceDescription',
      label: 'Detailed Sequence Description (for LLM)',
      type: 'textarea',
      required: false,
      admin: {
        description: 'A step-by-step natural language description of the entire workflow sequence, intended for LLM guidance.'
      }
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
          required: true, // Changed to required
          admin: {
            description: 'Describe the goal and context of this step clearly (e.g., "Click the Save button to submit the form").'
          }
        },
      //   {
      //     name: 'coordinates',
      //     label: 'Coordinates',
      //     type: 'group', // Changed from json to group for better structure
      //     fields: [
      //       {
      //         name: 'x',
      //         label: 'X Coordinate',
      //         type: 'number',
      //         required: true
      //       },
      //       {
      //         name: 'y',
      //         label: 'Y Coordinate',
      //         type: 'number',
      //         required: true
      //       }
      //     ],
      //     admin: {
      //       description: 'Required for click, move, drag actions.',
      //       // condition: (_, siblingData) => 
      //       //   ['left_click', 'right_click', 'middle_click', 'double_click', 'left_click_drag', 'mouse_move'].includes(siblingData.action)
      //     }
      //   },
      //   {
      //     name: 'endCoordinates',
      //     label: 'End Coordinates (Drag Only)',
      //     type: 'group', // Using group for consistency
      //     fields: [
      //       {
      //         name: 'x',
      //         label: 'X Coordinate',
      //         type: 'number',
      //         required: true
      //       },
      //       {
      //         name: 'y',
      //         label: 'Y Coordinate',
      //         type: 'number',
      //         required: true
      //       }
      //     ],
      //     admin: {
      //       description: 'End position for drag actions.',
      //       // condition: (_, siblingData) => siblingData.action === 'left_click_drag'
      //     }
      //   },
      //   {
      //     name: 'text',
      //     label: 'Text Input',
      //     type: 'text',
      //     required: false,
      //     admin: {
      //       description: 'Required for type and key actions.',
      //       // condition: (_, siblingData) => ['type', 'key'].includes(siblingData.action)
      //     }
      //   },
      //   {
      //     name: 'delay',
      //     label: 'Delay Before Action (ms)',
      //     type: 'number',
      //     defaultValue: 0,
      //     admin: {
      //       description: 'Time to wait before executing this step (in milliseconds).'
      //     }
      //   },
      //   {
      //     name: 'condition',
      //     label: 'Condition (Optional)',
      //     type: 'text',
      //     required: false,
      //     admin: {
      //       description: 'Optional condition to check before executing (e.g., "Wait until the Save button is visible").'
      //     }
      //   },
      //   {
      //     name: 'onError',
      //     label: 'On Error (Optional)',
      //     type: 'text',
      //     required: false,
      //     admin: {
      //       description: 'Instructions if this step fails (e.g., "Retry after 500ms" or "Skip to next step").'
      //     }
      //   },
      ],
    }
  ],
}