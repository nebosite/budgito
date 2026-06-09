import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewTransactionDialog, todayIso } from './new-transaction-dialog'

function renderDialog(
  overrides: Partial<{
    categories: string[]
    merchants: string[]
    accounts: string[]
    onAdd: (original: unknown) => void
    onCancel: () => void
  }> = {},
) {
  const onAdd = overrides.onAdd ?? vi.fn()
  const onCancel = overrides.onCancel ?? vi.fn()
  render(
    <NewTransactionDialog
      categories={overrides.categories ?? ['Groceries', 'Coffee']}
      merchants={overrides.merchants ?? ['Costco', 'Netflix']}
      accounts={overrides.accounts ?? ['Checking', 'Visa']}
      onAdd={onAdd}
      onCancel={onCancel}
    />,
  )
  return { onAdd, onCancel }
}

describe('NewTransactionDialog', () => {
  it('pre-fills date (today), amount ($0.00), and tags ("Manual")', () => {
    renderDialog()
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe(todayIso())
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('0.00')
    expect((screen.getByLabelText('Tags') as HTMLInputElement).value).toBe('Manual')
  })

  it('offers known merchants and accounts as datalist suggestions', () => {
    renderDialog({ merchants: ['Costco', 'Netflix'], accounts: ['Checking'] })

    const merchant = screen.getByLabelText('Merchant') as HTMLInputElement
    const merchantList = document.getElementById(merchant.getAttribute('list')!)
    expect(
      Array.from(merchantList!.querySelectorAll('option')).map((o) => o.value),
    ).toEqual(['Costco', 'Netflix'])

    const account = screen.getByLabelText('Account') as HTMLInputElement
    const accountList = document.getElementById(account.getAttribute('list')!)
    expect(
      Array.from(accountList!.querySelectorAll('option')).map((o) => o.value),
    ).toEqual(['Checking'])
  })

  it('allows a custom merchant not in the suggestion list', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderDialog({ merchants: ['Costco'] })
    await user.type(screen.getByLabelText('Merchant'), 'Brand New Store')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAdd.mock.calls[0][0]).toMatchObject({ merchant: 'Brand New Store' })
  })

  it('Add assembles the entered fields into a transaction and calls onAdd', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderDialog()

    await user.type(screen.getByLabelText('Merchant'), 'Costco')
    await user.type(screen.getByLabelText('Category'), 'Groceries')
    await user.type(screen.getByLabelText('Account'), 'Checking')
    const amount = screen.getByLabelText('Amount')
    await user.clear(amount)
    await user.type(amount, '-42.5')

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith({
      date: todayIso(),
      merchant: 'Costco',
      category: 'Groceries',
      account: 'Checking',
      originalStatement: '',
      notes: '',
      amount: -42.5,
      tags: 'Manual',
    })
  })

  it('treats a blank amount as 0', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderDialog()
    await user.clear(screen.getByLabelText('Amount'))
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAdd.mock.calls[0][0]).toMatchObject({ amount: 0 })
  })

  it('Cancel calls onCancel and not onAdd', async () => {
    const user = userEvent.setup()
    const { onAdd, onCancel } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('Escape cancels', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderDialog()
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
