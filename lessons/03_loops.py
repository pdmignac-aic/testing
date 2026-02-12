# ============================================
# LESSON 3: Loops (Repeating Things)
# ============================================
# Loops let you run the same code multiple times.
# Python has two main loops: for and while.

# --- for loop with range() ---
# range(5) gives numbers 0, 1, 2, 3, 4
print("Counting from 0 to 4:")
for i in range(5):
    print(i)

# range(start, stop) — stops BEFORE the stop number
print("\nCounting from 1 to 5:")
for i in range(1, 6):
    print(i)

# range(start, stop, step) — count by step
print("\nCounting by twos:")
for i in range(0, 11, 2):
    print(i)

# --- for loop with a list ---
# A list is an ordered collection of items in square brackets.
fruits = ["apple", "banana", "cherry"]

print("\nMy fruits:")
for fruit in fruits:
    print(f"  - {fruit}")

# --- Building up results with a loop ---
total = 0
for num in [10, 20, 30, 40]:
    total = total + num
print(f"\nSum: {total}")  # 100

# --- while loop ---
# Keeps running as long as the condition is True.
count = 1
print("\nWhile loop countdown:")
while count <= 5:
    print(count)
    count = count + 1  # Don't forget this or the loop never ends!

# --- break: exit a loop early ---
print("\nSearching for 'cherry':")
for fruit in ["apple", "banana", "cherry", "date"]:
    if fruit == "cherry":
        print("Found it!")
        break
    print(f"  Not {fruit}...")

# --- continue: skip to the next iteration ---
print("\nSkipping even numbers:")
for i in range(1, 8):
    if i % 2 == 0:
        continue  # skip the rest of this iteration
    print(i)

# --- Nested loops ---
print("\nMultiplication table (1-3):")
for row in range(1, 4):
    for col in range(1, 4):
        result = row * col
        print(f"  {row} x {col} = {result}")
    print()  # blank line between rows

# --- Looping with index using enumerate() ---
colors = ["red", "green", "blue"]
print("Colors with index:")
for index, color in enumerate(colors):
    print(f"  {index}: {color}")

# --- List comprehension (a shortcut) ---
# Create a new list by transforming each item.
numbers = [1, 2, 3, 4, 5]
squares = [n * n for n in numbers]
print(f"\nSquares: {squares}")  # [1, 4, 9, 16, 25]

# ============================================
# KEY TAKEAWAYS:
# 1. for loops iterate over a sequence (range, list, etc.)
# 2. while loops repeat as long as a condition is True
# 3. break exits a loop early
# 4. continue skips to the next iteration
# 5. range(start, stop, step) generates number sequences
# 6. Lists hold multiple values in order: [1, 2, 3]
# ============================================
