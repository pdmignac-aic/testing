# ============================================
# LESSON 4: Functions (Reusable Blocks of Code)
# ============================================
# A function is a named block of code you can call whenever you need it.
# It keeps your code organized and avoids repetition.

# --- Defining and calling a function ---
def say_hello():
    print("Hello, world!")

say_hello()  # Call the function
say_hello()  # Call it again — reuse!

# --- Functions with parameters ---
# Parameters let you pass data into a function.
def greet(name):
    print(f"Hello, {name}!")

greet("Alice")
greet("Bob")

# --- Multiple parameters ---
def add(a, b):
    print(f"{a} + {b} = {a + b}")

add(3, 5)
add(10, 20)

# --- Return values ---
# Use return to send a result back to the caller.
def multiply(a, b):
    return a * b

result = multiply(4, 7)
print(f"4 x 7 = {result}")

# You can use the return value directly:
print(f"3 x 9 = {multiply(3, 9)}")

# --- Default parameter values ---
def power(base, exponent=2):
    return base ** exponent

print(power(5))       # 25 (uses default exponent=2)
print(power(5, 3))    # 125 (exponent=3)

# --- Functions that return True/False ---
def is_even(number):
    return number % 2 == 0

print(is_even(4))   # True
print(is_even(7))   # False

# Use in an if statement:
if is_even(10):
    print("10 is even")

# --- Functions calling other functions ---
def square(n):
    return n * n

def sum_of_squares(a, b):
    return square(a) + square(b)

print(f"3^2 + 4^2 = {sum_of_squares(3, 4)}")  # 25

# --- A practical example: temperature converter ---
def celsius_to_fahrenheit(celsius):
    return (celsius * 9 / 5) + 32

def fahrenheit_to_celsius(fahrenheit):
    return (fahrenheit - 32) * 5 / 9

print(f"100C = {celsius_to_fahrenheit(100)}F")   # 212.0
print(f"72F = {fahrenheit_to_celsius(72):.1f}C") # 22.2

# --- Scope: variables inside functions are local ---
def my_function():
    secret = "only visible inside"
    print(secret)

my_function()
# print(secret)  # This would cause an error — secret doesn't exist out here

# ============================================
# KEY TAKEAWAYS:
# 1. Define functions with def name():
# 2. Parameters go in the parentheses: def greet(name):
# 3. return sends a value back to the caller
# 4. Default parameters: def func(x=10):
# 5. Functions keep code organized and reusable
# 6. Variables inside functions are local (not visible outside)
# ============================================
