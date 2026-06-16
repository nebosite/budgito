# Budgito - "I Budget, therefore I am."

A desktop application creating and sticking to a yearly budget. 

## Features

- **Import Monarch CSV exports.** Comma-separated files exported from
  Monarch Money are parsed, deduplicated against your current records,
  and merged in.
- **Override any field.** The original parsed row is preserved verbatim;
  the displayed and exported value comes from your override when one
  exists, otherwise from the original. Hover an overridden cell to see
  the original and remove the override.
- **Auto-ignore transfers.** On import, paired transactions that look
  like transfers between your own accounts are flagged as non-spending.
- **Pivot report.** Browse spending by category and month with row /
  column totals and per-month / per-year averages; click any cell to
  edit the transactions behind it.

## Download, Build, and Run

Prerequisites: [Node.js](https://nodejs.org/) 18 or later with npm.

```bash
# Clone the repository
git clone https://github.com/nebosite/Learning.git
cd Learning/claude/transaction-reader

# Install dependencies
npm install

# Build the application
npm run build

# Launch it
npm start
```

`npm run build` compiles the main, preload, and renderer bundles into
`out/`, and `npm start` runs Electron against that build. For
development with hot reload, use `npm run dev` instead of the
build/start pair.

## The Workflow

### Prerequisits

Before working with budgito, you will need a way to download your 
transactions from the internet.  Budgito current supports the 
transaction download file from two internet applications that
aggregate financial transactions: 
[Monarch](https://app.monarch.com/dashboard) 
and [YNAB](https://www.ynab.com/).  First, get set up with one of 
these apps, then follow these steps:

1. Hook up all your spending accounts, the ones that you use for 
   purchasing.  e.g.: Checking account, credit cards, Paypal, Venmo, etc. 
2. Make sure that all your spending accounts are caught up to the most
   recent data, then download transactions from each account.  In 
   Monarch, click on the account in the Accounts tab, then click 
   Edit->Download Transactions.  In YNAB, ...TBD... 

Ideally, you will be downloading transaction history that goes back more
than one year, but if you only have a few months, that's OK too. 

Note: if you are the kind of person that keeps your own transaction history
in a spreadsheet, then you can export a copy that looks like Monarch
by arranging your data into the following columns and exporting as a CSV:
* date
* merchant
* category
* account
* originalStatement
* notes
* amount
* tags
* owner

###  Your first transaction download

When you start working with transactions for the first time, you
will be working on the full list of transactions and creating a new
budget.  That's a log of work, and it may take up to 
a few hours, depending on the number of transactions and how
much your care about details.  The good news is it's only one-time.
The weekly workflow should only take about 5 minutes.  

#### Goal #1: Import and categorize everything.

1. On the transactions tab, click the "Import" button and import the
   transaction files you downloaded one at a time. (Click "save" often
   to protect your progress.) You only really need to work with recent 
   transactions (last 13 months)
   so, if you want to, you can use the date filter to exclude 
   transactions older than 13 months. 
2. Click the sort button on Category tab.  Look for transactions that 
   Have missing categories and give them a category.
3. Review the list overall and make sure categories are generally 
   correct.  Your budget will be much more useful with narrow categories,
   however that will take extra effort.  It's up to you.  
4. Notice that some transactions may be automatically ignored.  Budgito
   looks for transactions that appear to be moving money between
   accounts and ignores those because they don't represent real
   spending.  You can uningore these if you want, or you can choose
   to ignore additional items that you might have missed.  Ignored
   transactions are not included in the spending analysis or the budget.

#### Goal #2:  Look at your spending and refine categories

With all your transactions uploaded, now you are ready to look at the
"Spending Analysis" tab.  This shows your spending for the last 12 months.
From here, you can do a few things:

* Sort by the total amount to focus on the most significant categories.
* Click on individual cells to see what transactions are included.  These
  transactions can be edited to instantly update the chart.  Some useful
  edits include: changing the category, changing the date so it shows up 
  in a different month.  
* Use the merchant list to see how merchants fit in your yearly spending.

Remember to save your progress!

#### Goal #3:  Set up a budget

When your transactions a decently categorized, you are ready to create 
a budget!

1. Go to the Budget tab and click "New".  You will be asked to provide 
   a date and a start month.  I like to start my budgets in January, but
   there isn't any reason you can't start yours in some other month. 
   Budgets are always 12 months long.  You can create as many as you want.
2. Move categories to the correct sections.  This is optional, but it helps
   clarify the budget a lot!   A budget has three sections:
   "Income" for money coming in (paychecks, tax returns, bonuses, etc.), 
   "Bills" for money that goes out on a schedule (utilities, interest 
   payments, subscriptions, etc.), and "Discretionary" for 
   spending that his general unscheduled and more under your control
   (groceries, auto maintenance, emergency, etc.).  In a new budget, all
   categories start in descretionary, so click on the little "I" or "B"
   button to move them to other sections if they belong there.  
3. Fill in budget values.  Your budget starts out as zero.  You can fill
   out budget amounts by hand, or you can autofill based on your spending 
   analysis from the last year.  
4. Set up descretionary budgets.  On the far right of the page are special
   columns just for descretionary budgets.  One shows how much is budgeted - 
   you get to add a value here.  The other calculates how much is 
   remaining based on the values entered into the rows.  Normally, unless
   you have any planned expenses, you would then clear out the cells for 
   future dates.

Once your budget is filled out with all of your planned income and spending, 
you will see a "Bottom Line" value calculated on the top of the page.  You
want this value to be $0 or above!  If it is below zero, then you are
overspending your budget, so time to play with the numbers and see what you
can cut to reign in your spending for the year.  

### The weekly workflow

Once you get your initial budget set up, all you have to do is a few
minutes of mainenance every week:

1. Download fresh transaction data from the internet. 
2. Open budgito and import the fresh data.  Budgito knows if it has
   seen transactions before and it will only import new transactions.
   These show up in bold for this session.  Note: some providers 
   change minor details on a few transactions, so you might see cases
   where an essentially duplicate transaction shows up.  It's not
   common but something to watch for.  When you see it happen, simply
   delete the older, non-bolded one so it doesn't keep happening.
3. Edit the new transactions and ensure they have correct categories.

If the week is at the beginning of the month, reconcile the budget:

1. Go to your budget sheet and look at past months.  You want to see
   all gray boxes, because that means your spending matched your budget.
2. Make whatever adjustments you need to get to gray - usually this means
   adjusting the value in the cell to match what was spent. But you
   might also adjust the date to move the transaction to a different
   month.  In rare oddball cases, you change the amount, but that isn't
   recommended.
3. Look at the "remaining" column for anything that is red.  These
   are over-spent descretionary budgets.  The only thing to do is 
   add more money to cover the spending.  
4. Look at your bottom line.  Is it below zero?  It means you are 
   overspending your yearly budget!  You probably need to adjust
   descretionary budgets that still have money in them to get back 
   above zero. 

While reconciling the budget is where you can have conversations with
you partner about where the money is going.  By doing this every 
week, you can keep the stress to a minumum and avoid surprises.  


## File format

Master files are JSON with a versioned envelope; the shape is defined
in `src/shared/types.ts`. Re-importing the same CSV is idempotent —
records are keyed on the original line text and not duplicated.

## Development

| Command            | Purpose                              |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start the app in development mode    |
| `npm run build`    | Compile and bundle for production    |
| `npm run lint`     | Run ESLint                           |
| `npm run typecheck`| `tsc --noEmit`                       |
| `npm test`         | Run the unit tests                   |
